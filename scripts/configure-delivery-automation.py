"""Install the supervisor migration, mail worker and scheduled retries for VC's project.

Run from the repository root. Credentials are prompted and kept in memory.
"""
import getpass
import json
import pathlib
import secrets
import sys
import urllib.error
import urllib.request
import uuid

PROJECT = 'lfiasedcinrrikwkbbeb'
ORIGIN = 'https://vc-s-electrical-depot-ltd-production.up.railway.app'
BASE = 'https://api.supabase.com/v1/projects/' + PROJECT
root = pathlib.Path(__file__).resolve().parent.parent
token = getpass.getpass('Supabase management token for the VC project: ')
resend_key = getpass.getpass('Resend API key: ')
sender = input('Verified sender address, optionally with a display name: ').strip()
owner_email = input('Existing verified staff email to designate as Owner: ').strip().lower()
if '@' not in owner_email or len(owner_email) > 254:
    sys.exit('Enter the existing verified staff email for the Owner.')
if not resend_key or not sender or '@' not in sender or '\n' in sender or '\r' in sender:
    sys.exit('Enter an API key and verified sender address.')
worker_secret = secrets.token_urlsafe(36)


def request(path, data=None, content_type='application/json'):
    body = data if isinstance(data, bytes) else json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(BASE + path, data=body, headers={
        'Authorization': 'Bearer ' + token, 'Content-Type': content_type,
    })
    with urllib.request.urlopen(req, timeout=55) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


def query(sql):
    return request('/database/query', {'query': sql})


def literal(text):
    return "'" + text.replace("'", "''") + "'"


try:
    current = query("select to_regprocedure('public.vcs_supervisor_write(text,jsonb)') is not null as ready")
    if not current[0]['ready']:
        query((root / 'supabase/migrations/009_supervisor_deliveries.sql').read_text())
    owner = query("select s.user_id from public.staff_roles s join auth.users u on u.id=s.user_id where s.active and u.email_confirmed_at is not null and lower(u.email)=" + literal(owner_email))
    if len(owner) != 1:
        sys.exit('Owner email must match one existing active verified staff account.')
    query("update public.staff_roles set role='owner',permissions=null where user_id=" + literal(owner[0]['user_id']) + "::uuid")
    request('/secrets', [
        {'name': 'RESEND_API_KEY', 'value': resend_key},
        {'name': 'DELIVERY_EMAIL_FROM', 'value': sender},
        {'name': 'DELIVERY_AUTOMATION_SECRET', 'value': worker_secret},
        {'name': 'SITE_ORIGIN', 'value': ORIGIN},
    ])
    boundary = uuid.uuid4().hex
    parts = []
    metadata = {'name': 'vc-delivery-mail', 'entrypoint_path': 'vc-delivery-mail/index.ts', 'verify_jwt': False}
    parts.append(('--' + boundary + '\r\nContent-Disposition: form-data; name="metadata"\r\n'
                  'Content-Type: application/json\r\n\r\n').encode() + json.dumps(metadata).encode() + b'\r\n')
    for name in ['vc-delivery-mail/index.ts', '_shared/delivery-email.ts']:
        parts.append(('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="' +
                      name + '"\r\nContent-Type: application/typescript\r\n\r\n').encode() +
                     (root / 'supabase/functions' / name).read_bytes() + b'\r\n')
    parts.append(('--' + boundary + '--\r\n').encode())
    request('/functions/deploy?slug=vc-delivery-mail', b''.join(parts), 'multipart/form-data; boundary=' + boundary)

    # The scheduler reads a dedicated worker secret from Vault. Customer records stay in the private queue.
    query("""
    create extension if not exists pg_cron;
    create extension if not exists pg_net with schema extensions;
    do $$ declare current_id uuid; begin
      select id into current_id from vault.secrets where name='vcs_delivery_worker';
      if current_id is null then
        perform vault.create_secret(""" + literal(worker_secret) + """,'vcs_delivery_worker');
      else
        perform vault.update_secret(current_id,""" + literal(worker_secret) + """);
      end if;
    end $$;
    select cron.schedule('vcs-delivery-email-retries','* * * * *',$job$
      select net.http_post(
        url:='https://lfiasedcinrrikwkbbeb.supabase.co/functions/v1/vc-delivery-mail',
        headers:=jsonb_build_object('Content-Type','application/json','x-delivery-worker',
          (select decrypted_secret from vault.decrypted_secrets where name='vcs_delivery_worker')),
        body:='{"operation":"run"}'::jsonb,
        timeout_milliseconds:=55000
      );
    $job$);
    """)
    boundary = uuid.uuid4().hex
    source = (root / 'supabase/functions/vc-staff-setup/index.ts').read_bytes()
    metadata = json.dumps({'name': 'vc-staff-setup', 'entrypoint_path': 'index.ts', 'verify_jwt': False}).encode()
    payload = (
        ('--' + boundary + '\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n').encode() + metadata + b'\r\n' +
        ('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="index.ts"\r\nContent-Type: application/typescript\r\n\r\n').encode() + source + b'\r\n' +
        ('--' + boundary + '--\r\n').encode()
    )
    request('/functions/deploy?slug=vc-staff-setup', payload, 'multipart/form-data; boundary=' + boundary)
    status = query("select active from cron.job where jobname='vcs-delivery-email-retries'")
    if not status or not status[0]['active']:
        sys.exit('Worker deployed, but the retry schedule needs review.')
    print('Supervisor migration, delivery mail worker and minute-by-minute retries are configured.')
    print('Verify the sender domain in Resend, then use a controlled delivery record for the first live email.')
except urllib.error.HTTPError as error:
    sys.exit('Setup failed with HTTP ' + str(error.code) + '. Check project access and repeat setup after resolving it.')
except (urllib.error.URLError, TimeoutError, KeyError) as error:
    sys.exit('Setup failed (' + type(error).__name__ + '). Review the project and retry.')
