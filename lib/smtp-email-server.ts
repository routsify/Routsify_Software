import { randomUUID } from "node:crypto";
import { once } from "node:events";
import tls, { type TLSSocket } from "node:tls";
import { getOrganizationSecret } from "@/lib/organization-secrets-server";
import { loadThirdPartyIntegrationConfig } from "@/lib/third-party-integration-config-server";

const HOSTINGER_SMTP_HOST = "smtp.hostinger.com";
const HOSTINGER_SMTP_PORT = 465;
const SMTP_TIMEOUT_MS = 15_000;

class SmtpSession {
  private buffer = "";
  private lines: string[] = [];
  private waiters: Array<(line: string) => void> = [];

  constructor(private readonly socket: TLSSocket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.buffer += chunk;
      let index = this.buffer.indexOf("\r\n");
      while (index >= 0) {
        const line = this.buffer.slice(0, index);
        this.buffer = this.buffer.slice(index + 2);
        const waiter = this.waiters.shift();
        if (waiter) waiter(line);
        else this.lines.push(line);
        index = this.buffer.indexOf("\r\n");
      }
    });
  }

  private readLine() {
    const line = this.lines.shift();
    if (line !== undefined) return Promise.resolve(line);
    return new Promise<string>((resolve) => this.waiters.push(resolve));
  }

  async response(expected: number[]) {
    const output: string[] = [];
    let code = 0;
    while (true) {
      const line = await this.readLine();
      output.push(line);
      const match = line.match(/^(\d{3})([ -])/);
      if (!match) continue;
      code = Number(match[1]);
      if (match[2] === " ") break;
    }
    if (!expected.includes(code)) throw new Error(`smtp_${code}:${output.join(" | ").slice(0, 500)}`);
    return { code, output };
  }

  async command(command: string, expected: number[]) {
    this.socket.write(`${command}\r\n`);
    return this.response(expected);
  }

  write(value: string) {
    this.socket.write(value);
  }
}

function safeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodedHeader(value: string) {
  const clean = safeHeader(value);
  return /^[\x20-\x7E]*$/.test(clean) ? clean : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

function chunks(value: string, size = 76) {
  const output: string[] = [];
  for (let index = 0; index < value.length; index += size) output.push(value.slice(index, index + size));
  return output.join("\r\n");
}

function formatAddress(name: string, address: string) {
  const cleanAddress = safeHeader(address);
  return name ? `${encodedHeader(name)} <${cleanAddress}>` : cleanAddress;
}

function attachmentName(value: string) {
  return safeHeader(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "-")
    .slice(0, 160) || "documento.pdf";
}

async function connect(input: { host: string; port: number; username: string; password: string }) {
  const socket = tls.connect({ host: input.host, port: input.port, servername: input.host, rejectUnauthorized: true });
  socket.setTimeout(SMTP_TIMEOUT_MS, () => socket.destroy(new Error("smtp_timeout")));
  await once(socket, "secureConnect");
  const session = new SmtpSession(socket);
  await session.response([220]);
  await session.command("EHLO routsify-software", [250]);
  await session.command("AUTH LOGIN", [334]);
  await session.command(Buffer.from(input.username, "utf8").toString("base64"), [334]);
  await session.command(Buffer.from(input.password, "utf8").toString("base64"), [235]);
  return { socket, session };
}

export async function smtpConfiguration(organizationId: string) {
  const config = await loadThirdPartyIntegrationConfig(organizationId);
  const [username, password] = await Promise.all([
    getOrganizationSecret(organizationId, "smtp_username"),
    getOrganizationSecret(organizationId, "smtp_password"),
  ]);
  return {
    ...config.email,
    smtpHost: config.email.smtpHost || HOSTINGER_SMTP_HOST,
    smtpPort: config.email.smtpPort || HOSTINGER_SMTP_PORT,
    username,
    password,
  };
}

export async function testSmtpConnection(organizationId: string) {
  const config = await smtpConfiguration(organizationId);
  if (!config.enabled) return { ok: false as const, status: 503, error: "email_integration_disabled" };
  if (!config.smtpSecure) return { ok: false as const, status: 400, error: "smtp_starttls_not_supported_use_ssl_465" };
  if (!config.username || !config.password) return { ok: false as const, status: 503, error: "smtp_credentials_not_configured" };
  let socket: TLSSocket | null = null;
  try {
    const connection = await connect({ host: config.smtpHost, port: config.smtpPort, username: config.username, password: config.password });
    socket = connection.socket;
    await connection.session.command("NOOP", [250]);
    await connection.session.command("QUIT", [221]);
    return { ok: true as const, status: 200, host: config.smtpHost, port: config.smtpPort, username: config.username, fromAddress: config.fromAddress };
  } catch (error) {
    return { ok: false as const, status: 424, error: error instanceof Error ? error.message : "smtp_connection_failed" };
  } finally {
    socket?.destroy();
  }
}

export async function sendTransactionalEmail(input: {
  organizationId: string;
  to: string;
  subject: string;
  body: string;
  attachments?: Array<{ fileName: string; content: Buffer; contentType?: string }>;
}) {
  const config = await smtpConfiguration(input.organizationId);
  if (!config.enabled) return { ok: false as const, status: 503, error: "email_integration_disabled" };
  if (!config.smtpSecure) return { ok: false as const, status: 400, error: "smtp_starttls_not_supported_use_ssl_465" };
  if (!config.username || !config.password) return { ok: false as const, status: 503, error: "smtp_credentials_not_configured" };
  if (!config.fromAddress) return { ok: false as const, status: 400, error: "email_from_address_required" };
  if (!/^\S+@\S+\.\S+$/.test(input.to)) return { ok: false as const, status: 400, error: "invalid_recipient_email" };

  let socket: TLSSocket | null = null;
  try {
    const connection = await connect({ host: config.smtpHost, port: config.smtpPort, username: config.username, password: config.password });
    socket = connection.socket;
    await connection.session.command(`MAIL FROM:<${safeHeader(config.fromAddress)}>`, [250]);
    await connection.session.command(`RCPT TO:<${safeHeader(input.to)}>`, [250, 251]);
    await connection.session.command("DATA", [354]);

    const messageId = `<${randomUUID()}@${config.fromAddress.split("@")[1] || "routsify.local"}>`;
    const attachments = input.attachments || [];
    const boundary = `routsify-${randomUUID()}`;
    const headers = [
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${messageId}`,
      `From: ${formatAddress(config.fromName, config.fromAddress)}`,
      `To: ${safeHeader(input.to)}`,
      config.replyTo ? `Reply-To: ${safeHeader(config.replyTo)}` : null,
      `Subject: ${encodedHeader(input.subject || "Mensaje de Routsify")}`,
      "MIME-Version: 1.0",
      attachments.length ? `Content-Type: multipart/mixed; boundary="${boundary}"` : "Content-Type: text/plain; charset=UTF-8",
      attachments.length ? null : "Content-Transfer-Encoding: base64",
    ].filter(Boolean).join("\r\n");
    const encodedBody = chunks(Buffer.from(input.body, "utf8").toString("base64"));
    const mimeBody = attachments.length ? [
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      encodedBody,
      ...attachments.flatMap((attachment) => {
        const fileName = attachmentName(attachment.fileName);
        return [
          `--${boundary}`,
          `Content-Type: ${safeHeader(attachment.contentType || "application/octet-stream")}; name="${fileName}"`,
          `Content-Disposition: attachment; filename="${fileName}"`,
          "Content-Transfer-Encoding: base64",
          "",
          chunks(attachment.content.toString("base64")),
        ];
      }),
      `--${boundary}--`,
    ].join("\r\n") : encodedBody;
    connection.session.write(`${headers}\r\n\r\n${mimeBody}\r\n.\r\n`);
    await connection.session.response([250]);
    await connection.session.command("QUIT", [221]);
    return { ok: true as const, status: 200, provider: "hostinger_smtp", messageId };
  } catch (error) {
    return { ok: false as const, status: 424, error: error instanceof Error ? error.message : "smtp_send_failed" };
  } finally {
    socket?.destroy();
  }
}
