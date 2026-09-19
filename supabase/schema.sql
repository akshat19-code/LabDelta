-- ============================================================================
-- LabΔ (LabDelta) - Stage 3 Schema Migration
-- Tables: reports, measurements
-- Row Level Security (RLS) configured for strict tenant isolation
-- ============================================================================

-- 1. Reports Table
create table if not exists public.reports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    report_date date not null,
    lab_name text,
    source_type text not null default 'manual',
    created_at timestamptz not null default now()
);

-- 2. Measurements Table
create table if not exists public.measurements (
    id uuid primary key default gen_random_uuid(),
    report_id uuid not null references public.reports(id) on delete cascade,
    test_name_raw text not null,
    test_name_normalized text not null,
    value_numeric numeric,
    value_text text,
    unit text,
    reference_min numeric,
    reference_max numeric,
    reference_text text,
    created_at timestamptz not null default now()
);

-- 3. Helpful Indexes
create index if not exists idx_reports_user_id on public.reports(user_id);
create index if not exists idx_reports_user_date on public.reports(user_id, report_date desc);
create index if not exists idx_measurements_report_id on public.measurements(report_id);
create index if not exists idx_measurements_normalized on public.measurements(test_name_normalized);

-- 4. Enable Row Level Security (RLS)
alter table public.reports enable row level security;
alter table public.measurements enable row level security;

-- 5. RLS Policies for Reports
drop policy if exists "Users can view their own reports" on public.reports;
create policy "Users can view their own reports"
    on public.reports for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own reports" on public.reports;
create policy "Users can insert their own reports"
    on public.reports for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own reports" on public.reports;
create policy "Users can update their own reports"
    on public.reports for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own reports" on public.reports;
create policy "Users can delete their own reports"
    on public.reports for delete
    using (auth.uid() = user_id);

-- 6. RLS Policies for Measurements
drop policy if exists "Users can view measurements of their own reports" on public.measurements;
create policy "Users can view measurements of their own reports"
    on public.measurements for select
    using (
        exists (
            select 1 from public.reports
            where public.reports.id = public.measurements.report_id
              and public.reports.user_id = auth.uid()
        )
    );

drop policy if exists "Users can insert measurements into their own reports" on public.measurements;
create policy "Users can insert measurements into their own reports"
    on public.measurements for insert
    with check (
        exists (
            select 1 from public.reports
            where public.reports.id = public.measurements.report_id
              and public.reports.user_id = auth.uid()
        )
    );

drop policy if exists "Users can update measurements in their own reports" on public.measurements;
create policy "Users can update measurements in their own reports"
    on public.measurements for update
    using (
        exists (
            select 1 from public.reports
            where public.reports.id = public.measurements.report_id
              and public.reports.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.reports
            where public.reports.id = public.measurements.report_id
              and public.reports.user_id = auth.uid()
        )
    );

drop policy if exists "Users can delete measurements in their own reports" on public.measurements;
create policy "Users can delete measurements in their own reports"
    on public.measurements for delete
    using (
        exists (
            select 1 from public.reports
            where public.reports.id = public.measurements.report_id
              and public.reports.user_id = auth.uid()
        )
    );
