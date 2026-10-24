-- Items — capture multiplier.
--
-- A capture device multiplies the capture chance of a species. Only device
-- items use the column; every other category keeps the 1.00 default, which is
-- the neutral factor.
--
-- The value is non negative, so a malformed device can never invert the roll.
-- It is numeric(4, 2) because the catalog carries fractions such as 1.50.

alter table public.items
  add column capture_multiplier numeric(4, 2) not null default 1.00;

alter table public.items
  add constraint items_capture_multiplier_check check (capture_multiplier >= 0);
