update public.organizations set fiscal_mode='proforma_on_payment_final_after_trip', fiscal_mode_validated_at=coalesce(fiscal_mode_validated_at,now()), close_margin_days=5 where fiscal_mode is distinct from 'proforma_on_payment_final_after_trip' or fiscal_mode_validated_at is null or close_margin_days<>5;

