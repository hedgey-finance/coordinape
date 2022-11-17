CREATE TABLE "public"."locked_token_distribution" ("id" bigserial NOT NULL, "epoch_id" bigint NOT NULL, "gift_amount" numeric NOT NULL DEFAULT 0, "tx_hash" varchar, "distribution_json" jsonb NOT NULL DEFAULT jsonb_build_object(), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("id") , FOREIGN KEY ("epoch_id") REFERENCES "public"."epoches"("id") ON UPDATE restrict ON DELETE restrict, UNIQUE ("id"));
CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "set_public_locked_token_distribution_updated_at"
BEFORE UPDATE ON "public"."locked_token_distribution"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_locked_token_distribution_updated_at" ON "public"."locked_token_distribution" 
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
