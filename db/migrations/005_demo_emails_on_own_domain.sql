-- Demo sign-ins move to a domain we own: with email-based password reset switched on, an address on
-- someone else's domain could be used to take over the shared demo.
update neon_auth."user" set email = replace(email, '@demo.stayos.app', '@demo.stayos.space'), "emailVerified" = true
  where email like '%@demo.stayos.app';
update public.members set email = replace(email, '@demo.stayos.app', '@demo.stayos.space') where email like '%@demo.stayos.app';
