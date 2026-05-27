create unique index if not exists protection_tickets_contacts_viral_daily
  on public.protection_tickets (user_id, earned_date)
  where source = 'contacts_viral';
