alter table "public"."locked_token_distributions"
  add constraint "locked_token_distributions_updated_by_fkey"
  foreign key ("updated_by")
  references "public"."users"
  ("id") on update restrict on delete restrict;
