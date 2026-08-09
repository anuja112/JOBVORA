alter table public.job_applications
  add column if not exists pending_action text;

alter table public.job_applications
  drop constraint if exists job_applications_pending_action_check;

alter table public.job_applications
  add constraint job_applications_pending_action_check
  check (pending_action is null or pending_action in (
    'captcha_verification',
    'manual_form_completion',
    'manual_submission_review'
  ));
