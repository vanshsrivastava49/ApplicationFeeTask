-- LearnLynk Tech Test - Task 2: RLS Policies on leads

alter table public.leads enable row level security;

-- Example helper: assume JWT has tenant_id, user_id, role.
-- You can use: current_setting('request.jwt.claims', true)::jsonb

-- TODO: write a policy so:
-- - counselors see leads where they are owner_id OR in one of their teams
-- - admins can see all leads of their tenant
alter table public.leads add column if not exists team_id uuid;
alter table public.leads add constraint leads_team_fk foreign key (team_id) references public.teams(id) on delete set null;

-- Example skeleton for SELECT (replace with your own logic):

create policy "leads_select_policy"
on public.leads
for select
using (
  -- TODO: add real RLS logic here, refer to README instructions
  (
  (current_setting('request.jwt.claims', true)::jsonb->>'role')='admin'
  and tenant_id=(current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid)
  or
  (
    (current_setting('request.jwt.claims', true)::jsonb->>'role')='counselor'
    and tenant_id=(current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid)
    and(
      owner_id=(current_setting('request.jwt.claims', true)::jsonb->>'user_id')::uuid
      or
      exists(
        select 1
        from public.teams t
        join public.user_teams ut on ut.team_id=t.id
        where t.tenant_id=public.leads.tenant_id
          and t.id=public.leads.team_id
          and ut.user_id=(current_setting('request.jwt.claims', true)::jsonb->>'user_id')::uuid
      ))
);

-- TODO: add INSERT policy that:
-- - allows counselors/admins to insert leads for their tenant
-- - ensures tenant_id is correctly set/validated

create policy "leads_insert_policy"
on public.leads
for insert
with check(
  (current_setting('request.jwt.claims', true)::jsonb->>'role')in('counselor', 'admin')
  and
  tenant_id = (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid
);