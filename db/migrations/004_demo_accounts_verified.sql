-- The shared demo sign-ins are ours, so their emails count as verified (sign-up now requires verification).
update neon_auth."user" set "emailVerified" = true where email like '%@demo.stayos.app' and not "emailVerified";
