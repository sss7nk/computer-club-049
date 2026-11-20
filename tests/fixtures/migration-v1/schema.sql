-- Компьютерный клуб. Добрынин Д.А., ИСП-049. Только новая SQLite-база.

-- Включайте foreign_keys для каждого соединения. JSON1 входит в используемую SQLite.





-- Роли
CREATE TABLE roles (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id IS NULL OR (typeof(id)='integer' AND id>0)),
  code TEXT NOT NULL CHECK (code IS NULL OR (typeof(code)='text' AND length(trim(code))>0 AND code IN ('manager','admin','cashier','technician','accountant'))),
  name TEXT NOT NULL CHECK (name IS NULL OR (typeof(name)='text' AND length(trim(name))>0)),
  UNIQUE (code)
);

-- Сотрудники
CREATE TABLE staff (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id IS NULL OR (typeof(id)='integer' AND id>0)),
  full_name TEXT NOT NULL CHECK (full_name IS NULL OR (typeof(full_name)='text' AND length(trim(full_name))>0)),
  login TEXT NOT NULL CHECK (login IS NULL OR (typeof(login)='text' AND length(trim(login))>0)),
  password_hash TEXT NOT NULL CHECK (password_hash IS NULL OR (typeof(password_hash)='text' AND length(trim(password_hash))>0)),
  active INTEGER NOT NULL CHECK (active IS NULL OR (typeof(active)='integer' AND active IN (0,1))),
  UNIQUE (login)
);

-- Роли сотрудников
CREATE TABLE staff_roles (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id IS NULL OR (typeof(id)='integer' AND id>0)),
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (staff_id IS NULL OR (typeof(staff_id)='integer' AND staff_id>0)),
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (role_id IS NULL OR (typeof(role_id)='integer' AND role_id>0)),
  UNIQUE (staff_id, role_id)
);

-- Клиенты
CREATE TABLE clients (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id IS NULL OR (typeof(id)='integer' AND id>0)),
  full_name TEXT NOT NULL CHECK (full_name IS NULL OR (typeof(full_name)='text' AND length(trim(full_name))>0)),
  phone TEXT CHECK (phone IS NULL OR (typeof(phone)='text' AND length(trim(phone))>0)),
  UNIQUE (phone)
);

-- Зоны клуба
CREATE TABLE zones (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id IS NULL OR (typeof(id)='integer' AND id>0)),
  name TEXT NOT NULL CHECK (name IS NULL OR (typeof(name)='text' AND length(trim(name))>0)),
  active INTEGER NOT NULL CHECK (active IS NULL OR (typeof(active)='integer' AND active IN (0,1))),
  UNIQUE (name)
);

-- Категории мест
CREATE TABLE categories (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id IS NULL OR (typeof(id)='integer' AND id>0)),
  name TEXT NOT NULL CHECK (name IS NULL OR (typeof(name)='text' AND length(trim(name))>0)),
  description TEXT NOT NULL CHECK (description IS NULL OR (typeof(description)='text' AND length(trim(description))>0)),
  UNIQUE (name)
);

-- Рабочие места
CREATE TABLE workplaces (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id IS NULL OR (typeof(id)='integer' AND id>0)),
  number TEXT NOT NULL CHECK (number IS NULL OR (typeof(number)='text' AND length(trim(number))>0)),
  zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (zone_id IS NULL OR (typeof(zone_id)='integer' AND zone_id>0)),
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (category_id IS NULL OR (typeof(category_id)='integer' AND category_id>0)),
  condition TEXT NOT NULL CHECK (condition IS NULL OR (typeof(condition)='text' AND length(trim(condition))>0 AND condition IN ('available','maintenance'))),
  UNIQUE (number)
);

-- Тарифы
CREATE TABLE tariffs (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id IS NULL OR (typeof(id)='integer' AND id>0)),
  name TEXT NOT NULL CHECK (name IS NULL OR (typeof(name)='text' AND length(trim(name))>0)),
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (category_id IS NULL OR (typeof(category_id)='integer' AND category_id>0)),
  hourly_rate TEXT NOT NULL CHECK (hourly_rate IS NULL OR (typeof(hourly_rate)='text' AND hourly_rate GLOB '[0-9]*.[0-9][0-9]' AND hourly_rate NOT GLOB '*[^0-9.]*' AND instr(hourly_rate,'.')=length(hourly_rate)-2 AND length(replace(hourly_rate,'.',''))=length(hourly_rate)-1 AND length(replace(hourly_rate,'.',''))<=14)),
  valid_from TEXT NOT NULL CHECK (valid_from IS NULL OR (typeof(valid_from)='text' AND substr(valid_from,11,1)='T' AND julianday(valid_from) IS NOT NULL AND substr(valid_from,-6)='+03:00' AND (length(valid_from)=25 OR (length(valid_from) BETWEEN 27 AND 32 AND substr(valid_from,20,1)='.' AND substr(valid_from,21,length(valid_from)-26) NOT GLOB '*[^0-9]*')))),
  valid_to TEXT CHECK (valid_to IS NULL OR (typeof(valid_to)='text' AND substr(valid_to,11,1)='T' AND julianday(valid_to) IS NOT NULL AND substr(valid_to,-6)='+03:00' AND (length(valid_to)=25 OR (length(valid_to) BETWEEN 27 AND 32 AND substr(valid_to,20,1)='.' AND substr(valid_to,21,length(valid_to)-26) NOT GLOB '*[^0-9]*')))),
  active INTEGER NOT NULL CHECK (active IS NULL OR (typeof(active)='integer' AND active IN (0,1))),
  CHECK (valid_to IS NULL OR (CAST(strftime('%s',substr(valid_to,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(valid_to,20,1)='.' THEN CAST(substr(substr(valid_to,21,length(valid_to)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>(CAST(strftime('%s',substr(valid_from,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(valid_from,20,1)='.' THEN CAST(substr(substr(valid_from,21,length(valid_from)-26)||'000000',1,6) AS INTEGER) ELSE 0 END))
);

-- Бронирования
CREATE TABLE bookings (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id IS NULL OR (typeof(id)='integer' AND id>0)),
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (client_id IS NULL OR (typeof(client_id)='integer' AND client_id>0)),
  workplace_id INTEGER NOT NULL REFERENCES workplaces(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (workplace_id IS NULL OR (typeof(workplace_id)='integer' AND workplace_id>0)),
  tariff_id INTEGER NOT NULL REFERENCES tariffs(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (tariff_id IS NULL OR (typeof(tariff_id)='integer' AND tariff_id>0)),
  starts_at TEXT NOT NULL CHECK (starts_at IS NULL OR (typeof(starts_at)='text' AND substr(starts_at,11,1)='T' AND julianday(starts_at) IS NOT NULL AND substr(starts_at,-6)='+03:00' AND (length(starts_at)=25 OR (length(starts_at) BETWEEN 27 AND 32 AND substr(starts_at,20,1)='.' AND substr(starts_at,21,length(starts_at)-26) NOT GLOB '*[^0-9]*')))),
  ends_at TEXT NOT NULL CHECK (ends_at IS NULL OR (typeof(ends_at)='text' AND substr(ends_at,11,1)='T' AND julianday(ends_at) IS NOT NULL AND substr(ends_at,-6)='+03:00' AND (length(ends_at)=25 OR (length(ends_at) BETWEEN 27 AND 32 AND substr(ends_at,20,1)='.' AND substr(ends_at,21,length(ends_at)-26) NOT GLOB '*[^0-9]*')))),
  status TEXT NOT NULL CHECK (status IS NULL OR (typeof(status)='text' AND length(trim(status))>0 AND status IN ('confirmed','completed','cancelled','no_show'))),
  needs_resolution INTEGER NOT NULL CHECK (needs_resolution IS NULL OR (typeof(needs_resolution)='integer' AND needs_resolution IN (0,1))),
  fault_id INTEGER REFERENCES faults(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (fault_id IS NULL OR (typeof(fault_id)='integer' AND fault_id>0)),
  cancel_reason TEXT CHECK (cancel_reason IS NULL OR (typeof(cancel_reason)='text' AND length(trim(cancel_reason))>0)),
  changed_at TEXT NOT NULL CHECK (changed_at IS NULL OR (typeof(changed_at)='text' AND substr(changed_at,11,1)='T' AND julianday(changed_at) IS NOT NULL AND substr(changed_at,-6)='+03:00' AND (length(changed_at)=25 OR (length(changed_at) BETWEEN 27 AND 32 AND substr(changed_at,20,1)='.' AND substr(changed_at,21,length(changed_at)-26) NOT GLOB '*[^0-9]*')))),
  changed_by INTEGER NOT NULL REFERENCES staff(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (changed_by IS NULL OR (typeof(changed_by)='integer' AND changed_by>0)),
  CHECK ((CAST(strftime('%s',substr(ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(ends_at,20,1)='.' THEN CAST(substr(substr(ends_at,21,length(ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>(CAST(strftime('%s',substr(starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(starts_at,20,1)='.' THEN CAST(substr(substr(starts_at,21,length(starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)),
  CHECK (status!='cancelled' OR length(trim(coalesce(cancel_reason,'')))>0),
  CHECK (needs_resolution=0 OR (status='confirmed' AND fault_id IS NOT NULL))
);

-- Сеансы посещения
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id IS NULL OR (typeof(id)='integer' AND id>0)),
  booking_id INTEGER REFERENCES bookings(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (booking_id IS NULL OR (typeof(booking_id)='integer' AND booking_id>0)),
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (client_id IS NULL OR (typeof(client_id)='integer' AND client_id>0)),
  workplace_id INTEGER NOT NULL REFERENCES workplaces(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (workplace_id IS NULL OR (typeof(workplace_id)='integer' AND workplace_id>0)),
  tariff_id INTEGER NOT NULL REFERENCES tariffs(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (tariff_id IS NULL OR (typeof(tariff_id)='integer' AND tariff_id>0)),
  hourly_rate_snapshot TEXT NOT NULL CHECK (hourly_rate_snapshot IS NULL OR (typeof(hourly_rate_snapshot)='text' AND hourly_rate_snapshot GLOB '[0-9]*.[0-9][0-9]' AND hourly_rate_snapshot NOT GLOB '*[^0-9.]*' AND instr(hourly_rate_snapshot,'.')=length(hourly_rate_snapshot)-2 AND length(replace(hourly_rate_snapshot,'.',''))=length(hourly_rate_snapshot)-1 AND length(replace(hourly_rate_snapshot,'.',''))<=14)),
  started_at TEXT NOT NULL CHECK (started_at IS NULL OR (typeof(started_at)='text' AND substr(started_at,11,1)='T' AND julianday(started_at) IS NOT NULL AND substr(started_at,-6)='+03:00' AND (length(started_at)=25 OR (length(started_at) BETWEEN 27 AND 32 AND substr(started_at,20,1)='.' AND substr(started_at,21,length(started_at)-26) NOT GLOB '*[^0-9]*')))),
  planned_ends_at TEXT NOT NULL CHECK (planned_ends_at IS NULL OR (typeof(planned_ends_at)='text' AND substr(planned_ends_at,11,1)='T' AND julianday(planned_ends_at) IS NOT NULL AND substr(planned_ends_at,-6)='+03:00' AND (length(planned_ends_at)=25 OR (length(planned_ends_at) BETWEEN 27 AND 32 AND substr(planned_ends_at,20,1)='.' AND substr(planned_ends_at,21,length(planned_ends_at)-26) NOT GLOB '*[^0-9]*')))),
  ended_at TEXT CHECK (ended_at IS NULL OR (typeof(ended_at)='text' AND substr(ended_at,11,1)='T' AND julianday(ended_at) IS NOT NULL AND substr(ended_at,-6)='+03:00' AND (length(ended_at)=25 OR (length(ended_at) BETWEEN 27 AND 32 AND substr(ended_at,20,1)='.' AND substr(ended_at,21,length(ended_at)-26) NOT GLOB '*[^0-9]*')))),
  billable_minutes INTEGER CHECK (billable_minutes IS NULL OR (typeof(billable_minutes)='integer' AND billable_minutes>0)),
  total_amount TEXT CHECK (total_amount IS NULL OR (typeof(total_amount)='text' AND total_amount GLOB '[0-9]*.[0-9][0-9]' AND total_amount NOT GLOB '*[^0-9.]*' AND instr(total_amount,'.')=length(total_amount)-2 AND length(replace(total_amount,'.',''))=length(total_amount)-1 AND length(replace(total_amount,'.',''))<=14)),
  status TEXT NOT NULL CHECK (status IS NULL OR (typeof(status)='text' AND length(trim(status))>0 AND status IN ('active','completed'))),
  end_reason TEXT CHECK (end_reason IS NULL OR (typeof(end_reason)='text' AND length(trim(end_reason))>0)),
  UNIQUE (booking_id),
  CHECK ((CAST(strftime('%s',substr(planned_ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(planned_ends_at,20,1)='.' THEN CAST(substr(substr(planned_ends_at,21,length(planned_ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>(CAST(strftime('%s',substr(started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(started_at,20,1)='.' THEN CAST(substr(substr(started_at,21,length(started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)),
  CHECK ((status='active' AND ended_at IS NULL AND billable_minutes IS NULL AND total_amount IS NULL AND end_reason IS NULL) OR (status='completed' AND ended_at IS NOT NULL AND billable_minutes IS NOT NULL AND total_amount IS NOT NULL AND length(trim(coalesce(end_reason,'')))>0 AND (CAST(strftime('%s',substr(ended_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(ended_at,20,1)='.' THEN CAST(substr(substr(ended_at,21,length(ended_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>(CAST(strftime('%s',substr(started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(started_at,20,1)='.' THEN CAST(substr(substr(started_at,21,length(started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END))),
  CHECK (status='active' OR billable_minutes=(((CAST(strftime('%s',substr(ended_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(ended_at,20,1)='.' THEN CAST(substr(substr(ended_at,21,length(ended_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)-(CAST(strftime('%s',substr(started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(started_at,20,1)='.' THEN CAST(substr(substr(started_at,21,length(started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)+59999999)/60000000)),
  CHECK (status='active' OR CAST(replace(total_amount,'.','') AS INTEGER)=(CAST(replace(hourly_rate_snapshot,'.','') AS INTEGER)*billable_minutes+30)/60)
);

-- Способы оплаты
CREATE TABLE payment_methods (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id IS NULL OR (typeof(id)='integer' AND id>0)),
  code TEXT NOT NULL CHECK (code IS NULL OR (typeof(code)='text' AND length(trim(code))>0 AND code IN ('cash','card'))),
  name TEXT NOT NULL CHECK (name IS NULL OR (typeof(name)='text' AND length(trim(name))>0)),
  UNIQUE (code)
);

-- Оплаты
CREATE TABLE payments (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id IS NULL OR (typeof(id)='integer' AND id>0)),
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (session_id IS NULL OR (typeof(session_id)='integer' AND session_id>0)),
  amount TEXT NOT NULL CHECK (amount IS NULL OR (typeof(amount)='text' AND amount GLOB '[0-9]*.[0-9][0-9]' AND amount NOT GLOB '*[^0-9.]*' AND instr(amount,'.')=length(amount)-2 AND length(replace(amount,'.',''))=length(amount)-1 AND length(replace(amount,'.',''))<=14)),
  method_id INTEGER NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (method_id IS NULL OR (typeof(method_id)='integer' AND method_id>0)),
  paid_at TEXT NOT NULL CHECK (paid_at IS NULL OR (typeof(paid_at)='text' AND substr(paid_at,11,1)='T' AND julianday(paid_at) IS NOT NULL AND substr(paid_at,-6)='+03:00' AND (length(paid_at)=25 OR (length(paid_at) BETWEEN 27 AND 32 AND substr(paid_at,20,1)='.' AND substr(paid_at,21,length(paid_at)-26) NOT GLOB '*[^0-9]*')))),
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (staff_id IS NULL OR (typeof(staff_id)='integer' AND staff_id>0)),
  status TEXT NOT NULL CHECK (status IS NULL OR (typeof(status)='text' AND length(trim(status))>0 AND status IN ('paid'))),
  UNIQUE (session_id)
);

-- Неисправности
CREATE TABLE faults (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id IS NULL OR (typeof(id)='integer' AND id>0)),
  workplace_id INTEGER NOT NULL REFERENCES workplaces(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (workplace_id IS NULL OR (typeof(workplace_id)='integer' AND workplace_id>0)),
  description TEXT NOT NULL CHECK (description IS NULL OR (typeof(description)='text' AND length(trim(description))>0)),
  detected_at TEXT NOT NULL CHECK (detected_at IS NULL OR (typeof(detected_at)='text' AND substr(detected_at,11,1)='T' AND julianday(detected_at) IS NOT NULL AND substr(detected_at,-6)='+03:00' AND (length(detected_at)=25 OR (length(detected_at) BETWEEN 27 AND 32 AND substr(detected_at,20,1)='.' AND substr(detected_at,21,length(detected_at)-26) NOT GLOB '*[^0-9]*')))),
  detected_by INTEGER NOT NULL REFERENCES staff(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (detected_by IS NULL OR (typeof(detected_by)='integer' AND detected_by>0)),
  status TEXT NOT NULL CHECK (status IS NULL OR (typeof(status)='text' AND length(trim(status))>0 AND status IN ('open','resolved'))),
  resolution_note TEXT CHECK (resolution_note IS NULL OR (typeof(resolution_note)='text' AND length(trim(resolution_note))>0)),
  resolved_at TEXT CHECK (resolved_at IS NULL OR (typeof(resolved_at)='text' AND substr(resolved_at,11,1)='T' AND julianday(resolved_at) IS NOT NULL AND substr(resolved_at,-6)='+03:00' AND (length(resolved_at)=25 OR (length(resolved_at) BETWEEN 27 AND 32 AND substr(resolved_at,20,1)='.' AND substr(resolved_at,21,length(resolved_at)-26) NOT GLOB '*[^0-9]*')))),
  resolved_by INTEGER REFERENCES staff(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (resolved_by IS NULL OR (typeof(resolved_by)='integer' AND resolved_by>0)),
  CHECK ((status='open' AND resolved_at IS NULL AND resolved_by IS NULL AND resolution_note IS NULL) OR (status='resolved' AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL AND length(trim(coalesce(resolution_note,'')))>0 AND (CAST(strftime('%s',substr(resolved_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(resolved_at,20,1)='.' THEN CAST(substr(substr(resolved_at,21,length(resolved_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>=(CAST(strftime('%s',substr(detected_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(detected_at,20,1)='.' THEN CAST(substr(substr(detected_at,21,length(detected_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)))
);

-- Журнал действий
CREATE TABLE action_log (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id IS NULL OR (typeof(id)='integer' AND id>0)),
  entity_type TEXT NOT NULL CHECK (entity_type IS NULL OR (typeof(entity_type)='text' AND length(trim(entity_type))>0)),
  entity_id INTEGER NOT NULL CHECK (entity_id IS NULL OR (typeof(entity_id)='integer' AND entity_id>0)),
  action TEXT NOT NULL CHECK (action IS NULL OR (typeof(action)='text' AND length(trim(action))>0)),
  old_values TEXT NOT NULL CHECK (old_values IS NULL OR (CASE WHEN json_valid(old_values) THEN json_type(old_values)='object' ELSE 0 END)),
  new_values TEXT NOT NULL CHECK (new_values IS NULL OR (CASE WHEN json_valid(new_values) THEN json_type(new_values)='object' ELSE 0 END)),
  reason TEXT CHECK (reason IS NULL OR (typeof(reason)='text' AND length(trim(reason))>0)),
  occurred_at TEXT NOT NULL CHECK (occurred_at IS NULL OR (typeof(occurred_at)='text' AND substr(occurred_at,11,1)='T' AND julianday(occurred_at) IS NOT NULL AND substr(occurred_at,-6)='+03:00' AND (length(occurred_at)=25 OR (length(occurred_at) BETWEEN 27 AND 32 AND substr(occurred_at,20,1)='.' AND substr(occurred_at,21,length(occurred_at)-26) NOT GLOB '*[^0-9]*')))),
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED CHECK (staff_id IS NULL OR (typeof(staff_id)='integer' AND staff_id>0))
);

-- Служебные метаданные снимка; не являются пятнадцатой предметной сущностью.
CREATE TABLE meta (
 id INTEGER PRIMARY KEY CHECK(id=1), schema_version TEXT NOT NULL CHECK(schema_version='1.0'),
 timezone TEXT NOT NULL CHECK(timezone='Europe/Moscow'), currency TEXT NOT NULL CHECK(currency='RUB'),
 demo INTEGER NOT NULL CHECK(demo IN(0,1)), snapshot_at TEXT NOT NULL CHECK(typeof(snapshot_at)='text' AND substr(snapshot_at,11,1)='T' AND julianday(snapshot_at) IS NOT NULL AND substr(snapshot_at,-6)='+03:00' AND (length(snapshot_at)=25 OR (length(snapshot_at) BETWEEN 27 AND 32 AND substr(snapshot_at,20,1)='.' AND substr(snapshot_at,21,length(snapshot_at)-26) NOT GLOB '*[^0-9]*'))));

CREATE INDEX ix_staff_roles_staff_id ON staff_roles(staff_id);

CREATE INDEX ix_staff_roles_role_id ON staff_roles(role_id);

CREATE INDEX ix_workplaces_zone_id ON workplaces(zone_id);

CREATE INDEX ix_workplaces_category_id ON workplaces(category_id);

CREATE INDEX ix_tariffs_category_id ON tariffs(category_id);

CREATE INDEX ix_bookings_client_id ON bookings(client_id);

CREATE INDEX ix_bookings_workplace_id ON bookings(workplace_id);

CREATE INDEX ix_bookings_tariff_id ON bookings(tariff_id);

CREATE INDEX ix_bookings_fault_id ON bookings(fault_id);

CREATE INDEX ix_bookings_changed_by ON bookings(changed_by);

CREATE INDEX ix_sessions_client_id ON sessions(client_id);

CREATE INDEX ix_sessions_workplace_id ON sessions(workplace_id);

CREATE INDEX ix_sessions_tariff_id ON sessions(tariff_id);

CREATE INDEX ix_payments_method_id ON payments(method_id);

CREATE INDEX ix_payments_staff_id ON payments(staff_id);

CREATE INDEX ix_faults_workplace_id ON faults(workplace_id);

CREATE INDEX ix_faults_detected_by ON faults(detected_by);

CREATE INDEX ix_faults_resolved_by ON faults(resolved_by);

CREATE INDEX ix_action_log_staff_id ON action_log(staff_id);

CREATE INDEX ix_bookings_interval ON bookings(workplace_id,status,starts_at,ends_at);

CREATE INDEX ix_sessions_interval ON sessions(workplace_id,started_at,planned_ends_at);

CREATE INDEX ix_payments_time ON payments(paid_at);

CREATE INDEX ix_faults_interval ON faults(workplace_id,detected_at,resolved_at);

CREATE TRIGGER booking_insert BEFORE INSERT ON bookings BEGIN
 SELECT RAISE(ABORT,'Бронь: неисправность другого места') WHERE NEW.needs_resolution=1 AND NOT EXISTS(SELECT 1 FROM faults f WHERE f.id=NEW.fault_id AND f.workplace_id=NEW.workplace_id);
 SELECT RAISE(ABORT,'Бронь: тариф другой категории') WHERE (SELECT category_id FROM workplaces WHERE id=NEW.workplace_id)!=(SELECT category_id FROM tariffs WHERE id=NEW.tariff_id);
 SELECT RAISE(ABORT,'Тариф не действует на начало брони') WHERE NEW.status='confirmed' AND NOT EXISTS(SELECT 1 FROM sessions WHERE booking_id=NEW.id) AND EXISTS(SELECT 1 FROM tariffs t WHERE t.id=NEW.tariff_id AND ((CAST(strftime('%s',substr(NEW.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.starts_at,20,1)='.' THEN CAST(substr(substr(NEW.starts_at,21,length(NEW.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(t.valid_from,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(t.valid_from,20,1)='.' THEN CAST(substr(substr(t.valid_from,21,length(t.valid_from)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) OR (t.valid_to IS NOT NULL AND (CAST(strftime('%s',substr(NEW.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.starts_at,20,1)='.' THEN CAST(substr(substr(NEW.starts_at,21,length(NEW.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>=(CAST(strftime('%s',substr(t.valid_to,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(t.valid_to,20,1)='.' THEN CAST(substr(substr(t.valid_to,21,length(t.valid_to)-26)||'000000',1,6) AS INTEGER) ELSE 0 END))));
 SELECT RAISE(ABORT,'Для брони неисправного места нужно решение по поломке') WHERE NEW.status='confirmed' AND NEW.needs_resolution=0 AND (SELECT condition FROM workplaces WHERE id=NEW.workplace_id)!='available' AND NOT EXISTS(SELECT 1 FROM sessions WHERE booking_id=NEW.id);
 SELECT RAISE(ABORT,'Пересечение подтверждённых броней') WHERE NEW.status='confirmed' AND EXISTS(SELECT 1 FROM bookings b WHERE b.id!=NEW.id AND b.workplace_id=NEW.workplace_id AND b.status='confirmed' AND (CAST(strftime('%s',substr(NEW.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.starts_at,20,1)='.' THEN CAST(substr(substr(NEW.starts_at,21,length(NEW.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(b.ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(b.ends_at,20,1)='.' THEN CAST(substr(substr(b.ends_at,21,length(b.ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) AND (CAST(strftime('%s',substr(b.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(b.starts_at,20,1)='.' THEN CAST(substr(substr(b.starts_at,21,length(b.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(NEW.ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.ends_at,20,1)='.' THEN CAST(substr(substr(NEW.ends_at,21,length(NEW.ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
 SELECT RAISE(ABORT,'Бронь пересекает активный сеанс') WHERE NEW.status='confirmed' AND EXISTS(SELECT 1 FROM sessions s WHERE s.status='active' AND s.workplace_id=NEW.workplace_id AND (s.booking_id IS NULL OR s.booking_id!=NEW.id) AND (CAST(strftime('%s',substr(NEW.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.starts_at,20,1)='.' THEN CAST(substr(substr(NEW.starts_at,21,length(NEW.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(s.planned_ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(s.planned_ends_at,20,1)='.' THEN CAST(substr(substr(s.planned_ends_at,21,length(s.planned_ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) AND (CAST(strftime('%s',substr(s.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(s.started_at,20,1)='.' THEN CAST(substr(substr(s.started_at,21,length(s.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(NEW.ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.ends_at,20,1)='.' THEN CAST(substr(substr(NEW.ends_at,21,length(NEW.ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
 SELECT RAISE(ABORT,'Слишком ранняя неявка') WHERE NEW.status='no_show' AND (CAST(strftime('%s',substr(NEW.changed_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.changed_at,20,1)='.' THEN CAST(substr(substr(NEW.changed_at,21,length(NEW.changed_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) < min((CAST(strftime('%s',substr(NEW.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.starts_at,20,1)='.' THEN CAST(substr(substr(NEW.starts_at,21,length(NEW.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)+900000000,(CAST(strftime('%s',substr(NEW.ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.ends_at,20,1)='.' THEN CAST(substr(substr(NEW.ends_at,21,length(NEW.ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
 SELECT RAISE(ABORT,'Начатую бронь нельзя отменить или считать неявкой') WHERE NEW.status IN('no_show','cancelled') AND EXISTS(SELECT 1 FROM sessions WHERE booking_id=NEW.id);
END;

CREATE TRIGGER session_insert BEFORE INSERT ON sessions BEGIN
 SELECT RAISE(ABORT,'Сеанс: ставка или категория не соответствует версии тарифа') WHERE NOT EXISTS(SELECT 1 FROM tariffs t JOIN workplaces w ON w.id=NEW.workplace_id WHERE t.id=NEW.tariff_id AND t.category_id=w.category_id AND t.hourly_rate=NEW.hourly_rate_snapshot);
 SELECT RAISE(ABORT,'Тариф не действовал при запуске') WHERE EXISTS(SELECT 1 FROM tariffs t WHERE t.id=NEW.tariff_id AND ((CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(t.valid_from,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(t.valid_from,20,1)='.' THEN CAST(substr(substr(t.valid_from,21,length(t.valid_from)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) OR (t.valid_to IS NOT NULL AND (CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>=(CAST(strftime('%s',substr(t.valid_to,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(t.valid_to,20,1)='.' THEN CAST(substr(substr(t.valid_to,21,length(t.valid_to)-26)||'000000',1,6) AS INTEGER) ELSE 0 END))));
 SELECT RAISE(ABORT,'Сеанс не соответствует брони') WHERE NEW.booking_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.id=NEW.booking_id AND b.client_id=NEW.client_id AND b.workplace_id=NEW.workplace_id AND b.tariff_id=NEW.tariff_id AND b.needs_resolution=0 AND ((NEW.status='active' AND b.status='confirmed') OR (NEW.status='completed' AND b.status IN('confirmed','completed'))));
 SELECT RAISE(ABORT,'Срок ожидания брони истёк') WHERE NEW.booking_id IS NOT NULL AND EXISTS(SELECT 1 FROM bookings b WHERE b.id=NEW.booking_id AND (CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>=min((CAST(strftime('%s',substr(b.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(b.starts_at,20,1)='.' THEN CAST(substr(substr(b.starts_at,21,length(b.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)+900000000,(CAST(strftime('%s',substr(b.ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(b.ends_at,20,1)='.' THEN CAST(substr(substr(b.ends_at,21,length(b.ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)));
 SELECT RAISE(ABORT,'Пересечение сеансов места или клиента') WHERE EXISTS(SELECT 1 FROM sessions s WHERE s.id!=NEW.id AND (s.workplace_id=NEW.workplace_id OR s.client_id=NEW.client_id) AND (CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(coalesce(s.ended_at,s.planned_ends_at),1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(coalesce(s.ended_at,s.planned_ends_at),20,1)='.' THEN CAST(substr(substr(coalesce(s.ended_at,s.planned_ends_at),21,length(coalesce(s.ended_at,s.planned_ends_at))-26)||'000000',1,6) AS INTEGER) ELSE 0 END) AND (CAST(strftime('%s',substr(s.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(s.started_at,20,1)='.' THEN CAST(substr(substr(s.started_at,21,length(s.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(coalesce(NEW.ended_at,NEW.planned_ends_at),1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(coalesce(NEW.ended_at,NEW.planned_ends_at),20,1)='.' THEN CAST(substr(substr(coalesce(NEW.ended_at,NEW.planned_ends_at),21,length(coalesce(NEW.ended_at,NEW.planned_ends_at))-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
 SELECT RAISE(ABORT,'Сеанс пересекает чужую бронь') WHERE NEW.status='active' AND EXISTS(SELECT 1 FROM bookings b WHERE b.workplace_id=NEW.workplace_id AND b.status='confirmed' AND (NEW.booking_id IS NULL OR b.id!=NEW.booking_id) AND (CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(b.ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(b.ends_at,20,1)='.' THEN CAST(substr(substr(b.ends_at,21,length(b.ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) AND (CAST(strftime('%s',substr(b.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(b.starts_at,20,1)='.' THEN CAST(substr(substr(b.starts_at,21,length(b.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(NEW.planned_ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.planned_ends_at,20,1)='.' THEN CAST(substr(substr(NEW.planned_ends_at,21,length(NEW.planned_ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
 SELECT RAISE(ABORT,'Нельзя запускать сеанс в период неисправности') WHERE EXISTS(SELECT 1 FROM faults f WHERE f.workplace_id=NEW.workplace_id AND (CAST(strftime('%s',substr(f.detected_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(f.detected_at,20,1)='.' THEN CAST(substr(substr(f.detected_at,21,length(f.detected_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<=(CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) AND (f.resolved_at IS NULL OR (CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(f.resolved_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(f.resolved_at,20,1)='.' THEN CAST(substr(substr(f.resolved_at,21,length(f.resolved_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)));
 SELECT RAISE(ABORT,'Нельзя начислять время после поломки') WHERE NEW.ended_at IS NOT NULL AND EXISTS(SELECT 1 FROM faults f WHERE f.workplace_id=NEW.workplace_id AND (CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(f.detected_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(f.detected_at,20,1)='.' THEN CAST(substr(substr(f.detected_at,21,length(f.detected_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) AND (CAST(strftime('%s',substr(f.detected_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(f.detected_at,20,1)='.' THEN CAST(substr(substr(f.detected_at,21,length(f.detected_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(NEW.ended_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.ended_at,20,1)='.' THEN CAST(substr(substr(NEW.ended_at,21,length(NEW.ended_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
 SELECT RAISE(ABORT,'Место на обслуживании') WHERE NEW.status='active' AND (SELECT condition FROM workplaces WHERE id=NEW.workplace_id)!='available';
END;

CREATE TRIGGER payment_insert BEFORE INSERT ON payments BEGIN
 SELECT RAISE(ABORT,'Нужна полная оплата завершённого сеанса') WHERE NOT EXISTS(SELECT 1 FROM sessions s WHERE s.id=NEW.session_id AND s.status='completed' AND s.total_amount=NEW.amount AND (CAST(strftime('%s',substr(NEW.paid_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.paid_at,20,1)='.' THEN CAST(substr(substr(NEW.paid_at,21,length(NEW.paid_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>=(CAST(strftime('%s',substr(s.ended_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(s.ended_at,20,1)='.' THEN CAST(substr(substr(s.ended_at,21,length(s.ended_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
END;

CREATE TRIGGER log_insert BEFORE INSERT ON action_log BEGIN
 SELECT RAISE(ABORT,'Не найден объект журнала') WHERE NOT ((NEW.entity_type='roles' AND EXISTS(SELECT 1 FROM roles WHERE id=NEW.entity_id)) OR (NEW.entity_type='staff' AND EXISTS(SELECT 1 FROM staff WHERE id=NEW.entity_id)) OR (NEW.entity_type='staff_roles' AND EXISTS(SELECT 1 FROM staff_roles WHERE id=NEW.entity_id)) OR (NEW.entity_type='clients' AND EXISTS(SELECT 1 FROM clients WHERE id=NEW.entity_id)) OR (NEW.entity_type='zones' AND EXISTS(SELECT 1 FROM zones WHERE id=NEW.entity_id)) OR (NEW.entity_type='categories' AND EXISTS(SELECT 1 FROM categories WHERE id=NEW.entity_id)) OR (NEW.entity_type='workplaces' AND EXISTS(SELECT 1 FROM workplaces WHERE id=NEW.entity_id)) OR (NEW.entity_type='tariffs' AND EXISTS(SELECT 1 FROM tariffs WHERE id=NEW.entity_id)) OR (NEW.entity_type='bookings' AND EXISTS(SELECT 1 FROM bookings WHERE id=NEW.entity_id)) OR (NEW.entity_type='sessions' AND EXISTS(SELECT 1 FROM sessions WHERE id=NEW.entity_id)) OR (NEW.entity_type='payment_methods' AND EXISTS(SELECT 1 FROM payment_methods WHERE id=NEW.entity_id)) OR (NEW.entity_type='payments' AND EXISTS(SELECT 1 FROM payments WHERE id=NEW.entity_id)) OR (NEW.entity_type='faults' AND EXISTS(SELECT 1 FROM faults WHERE id=NEW.entity_id)) OR (NEW.entity_type='action_log' AND EXISTS(SELECT 1 FROM action_log WHERE id=NEW.entity_id)));
 SELECT RAISE(ABORT,'Перенос требует причины и прежних/новых значений') WHERE NEW.action='move' AND (length(trim(coalesce(NEW.reason,'')))=0 OR NEW.old_values='{}' OR NEW.new_values='{}' OR NEW.entity_type!='bookings');
END;

CREATE TRIGGER booking_update BEFORE UPDATE ON bookings BEGIN
 SELECT RAISE(ABORT,'Бронь: неисправность другого места') WHERE NEW.needs_resolution=1 AND NOT EXISTS(SELECT 1 FROM faults f WHERE f.id=NEW.fault_id AND f.workplace_id=NEW.workplace_id);
 SELECT RAISE(ABORT,'Бронь: тариф другой категории') WHERE (SELECT category_id FROM workplaces WHERE id=NEW.workplace_id)!=(SELECT category_id FROM tariffs WHERE id=NEW.tariff_id);
 SELECT RAISE(ABORT,'Тариф не действует на начало брони') WHERE NEW.status='confirmed' AND NOT EXISTS(SELECT 1 FROM sessions WHERE booking_id=NEW.id) AND EXISTS(SELECT 1 FROM tariffs t WHERE t.id=NEW.tariff_id AND ((CAST(strftime('%s',substr(NEW.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.starts_at,20,1)='.' THEN CAST(substr(substr(NEW.starts_at,21,length(NEW.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(t.valid_from,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(t.valid_from,20,1)='.' THEN CAST(substr(substr(t.valid_from,21,length(t.valid_from)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) OR (t.valid_to IS NOT NULL AND (CAST(strftime('%s',substr(NEW.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.starts_at,20,1)='.' THEN CAST(substr(substr(NEW.starts_at,21,length(NEW.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>=(CAST(strftime('%s',substr(t.valid_to,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(t.valid_to,20,1)='.' THEN CAST(substr(substr(t.valid_to,21,length(t.valid_to)-26)||'000000',1,6) AS INTEGER) ELSE 0 END))));
 SELECT RAISE(ABORT,'Для брони неисправного места нужно решение по поломке') WHERE NEW.status='confirmed' AND NEW.needs_resolution=0 AND (SELECT condition FROM workplaces WHERE id=NEW.workplace_id)!='available' AND NOT EXISTS(SELECT 1 FROM sessions WHERE booking_id=NEW.id);
 SELECT RAISE(ABORT,'Пересечение подтверждённых броней') WHERE NEW.status='confirmed' AND EXISTS(SELECT 1 FROM bookings b WHERE b.id!=NEW.id AND b.workplace_id=NEW.workplace_id AND b.status='confirmed' AND (CAST(strftime('%s',substr(NEW.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.starts_at,20,1)='.' THEN CAST(substr(substr(NEW.starts_at,21,length(NEW.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(b.ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(b.ends_at,20,1)='.' THEN CAST(substr(substr(b.ends_at,21,length(b.ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) AND (CAST(strftime('%s',substr(b.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(b.starts_at,20,1)='.' THEN CAST(substr(substr(b.starts_at,21,length(b.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(NEW.ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.ends_at,20,1)='.' THEN CAST(substr(substr(NEW.ends_at,21,length(NEW.ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
 SELECT RAISE(ABORT,'Бронь пересекает активный сеанс') WHERE NEW.status='confirmed' AND EXISTS(SELECT 1 FROM sessions s WHERE s.status='active' AND s.workplace_id=NEW.workplace_id AND (s.booking_id IS NULL OR s.booking_id!=NEW.id) AND (CAST(strftime('%s',substr(NEW.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.starts_at,20,1)='.' THEN CAST(substr(substr(NEW.starts_at,21,length(NEW.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(s.planned_ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(s.planned_ends_at,20,1)='.' THEN CAST(substr(substr(s.planned_ends_at,21,length(s.planned_ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) AND (CAST(strftime('%s',substr(s.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(s.started_at,20,1)='.' THEN CAST(substr(substr(s.started_at,21,length(s.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(NEW.ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.ends_at,20,1)='.' THEN CAST(substr(substr(NEW.ends_at,21,length(NEW.ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
 SELECT RAISE(ABORT,'Слишком ранняя неявка') WHERE NEW.status='no_show' AND (CAST(strftime('%s',substr(NEW.changed_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.changed_at,20,1)='.' THEN CAST(substr(substr(NEW.changed_at,21,length(NEW.changed_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) < min((CAST(strftime('%s',substr(NEW.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.starts_at,20,1)='.' THEN CAST(substr(substr(NEW.starts_at,21,length(NEW.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)+900000000,(CAST(strftime('%s',substr(NEW.ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.ends_at,20,1)='.' THEN CAST(substr(substr(NEW.ends_at,21,length(NEW.ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
 SELECT RAISE(ABORT,'Начатую бронь нельзя отменить или считать неявкой') WHERE NEW.status IN('no_show','cancelled') AND EXISTS(SELECT 1 FROM sessions WHERE booking_id=NEW.id);
 SELECT RAISE(ABORT,'Конечный статус брони необратим') WHERE OLD.status!='confirmed' AND (NEW.status!=OLD.status OR NEW.client_id!=OLD.client_id OR NEW.workplace_id!=OLD.workplace_id OR NEW.tariff_id!=OLD.tariff_id OR NEW.starts_at!=OLD.starts_at OR NEW.ends_at!=OLD.ends_at);
 SELECT RAISE(ABORT,'Начатую бронь нельзя переносить') WHERE EXISTS(SELECT 1 FROM sessions WHERE booking_id=OLD.id) AND (NEW.client_id!=OLD.client_id OR NEW.workplace_id!=OLD.workplace_id OR NEW.tariff_id!=OLD.tariff_id OR NEW.starts_at!=OLD.starts_at OR NEW.ends_at!=OLD.ends_at OR NEW.needs_resolution=1);
 SELECT RAISE(ABORT,'Сначала завершите связанный сеанс') WHERE NEW.status='completed' AND NOT EXISTS(SELECT 1 FROM sessions WHERE booking_id=NEW.id AND status='completed');
END;

CREATE TRIGGER session_update BEFORE UPDATE ON sessions BEGIN
 SELECT RAISE(ABORT,'Сеанс: ставка или категория не соответствует версии тарифа') WHERE NOT EXISTS(SELECT 1 FROM tariffs t JOIN workplaces w ON w.id=NEW.workplace_id WHERE t.id=NEW.tariff_id AND t.category_id=w.category_id AND t.hourly_rate=NEW.hourly_rate_snapshot);
 SELECT RAISE(ABORT,'Тариф не действовал при запуске') WHERE EXISTS(SELECT 1 FROM tariffs t WHERE t.id=NEW.tariff_id AND ((CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(t.valid_from,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(t.valid_from,20,1)='.' THEN CAST(substr(substr(t.valid_from,21,length(t.valid_from)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) OR (t.valid_to IS NOT NULL AND (CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>=(CAST(strftime('%s',substr(t.valid_to,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(t.valid_to,20,1)='.' THEN CAST(substr(substr(t.valid_to,21,length(t.valid_to)-26)||'000000',1,6) AS INTEGER) ELSE 0 END))));
 SELECT RAISE(ABORT,'Сеанс не соответствует брони') WHERE NEW.booking_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.id=NEW.booking_id AND b.client_id=NEW.client_id AND b.workplace_id=NEW.workplace_id AND b.tariff_id=NEW.tariff_id AND b.needs_resolution=0 AND ((NEW.status='active' AND b.status='confirmed') OR (NEW.status='completed' AND b.status IN('confirmed','completed'))));
 SELECT RAISE(ABORT,'Срок ожидания брони истёк') WHERE NEW.booking_id IS NOT NULL AND EXISTS(SELECT 1 FROM bookings b WHERE b.id=NEW.booking_id AND (CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>=min((CAST(strftime('%s',substr(b.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(b.starts_at,20,1)='.' THEN CAST(substr(substr(b.starts_at,21,length(b.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)+900000000,(CAST(strftime('%s',substr(b.ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(b.ends_at,20,1)='.' THEN CAST(substr(substr(b.ends_at,21,length(b.ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)));
 SELECT RAISE(ABORT,'Пересечение сеансов места или клиента') WHERE EXISTS(SELECT 1 FROM sessions s WHERE s.id!=NEW.id AND (s.workplace_id=NEW.workplace_id OR s.client_id=NEW.client_id) AND (CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(coalesce(s.ended_at,s.planned_ends_at),1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(coalesce(s.ended_at,s.planned_ends_at),20,1)='.' THEN CAST(substr(substr(coalesce(s.ended_at,s.planned_ends_at),21,length(coalesce(s.ended_at,s.planned_ends_at))-26)||'000000',1,6) AS INTEGER) ELSE 0 END) AND (CAST(strftime('%s',substr(s.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(s.started_at,20,1)='.' THEN CAST(substr(substr(s.started_at,21,length(s.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(coalesce(NEW.ended_at,NEW.planned_ends_at),1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(coalesce(NEW.ended_at,NEW.planned_ends_at),20,1)='.' THEN CAST(substr(substr(coalesce(NEW.ended_at,NEW.planned_ends_at),21,length(coalesce(NEW.ended_at,NEW.planned_ends_at))-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
 SELECT RAISE(ABORT,'Сеанс пересекает чужую бронь') WHERE NEW.status='active' AND EXISTS(SELECT 1 FROM bookings b WHERE b.workplace_id=NEW.workplace_id AND b.status='confirmed' AND (NEW.booking_id IS NULL OR b.id!=NEW.booking_id) AND (CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(b.ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(b.ends_at,20,1)='.' THEN CAST(substr(substr(b.ends_at,21,length(b.ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) AND (CAST(strftime('%s',substr(b.starts_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(b.starts_at,20,1)='.' THEN CAST(substr(substr(b.starts_at,21,length(b.starts_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(NEW.planned_ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.planned_ends_at,20,1)='.' THEN CAST(substr(substr(NEW.planned_ends_at,21,length(NEW.planned_ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
 SELECT RAISE(ABORT,'Нельзя запускать сеанс в период неисправности') WHERE EXISTS(SELECT 1 FROM faults f WHERE f.workplace_id=NEW.workplace_id AND (CAST(strftime('%s',substr(f.detected_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(f.detected_at,20,1)='.' THEN CAST(substr(substr(f.detected_at,21,length(f.detected_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<=(CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) AND (f.resolved_at IS NULL OR (CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(f.resolved_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(f.resolved_at,20,1)='.' THEN CAST(substr(substr(f.resolved_at,21,length(f.resolved_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)));
 SELECT RAISE(ABORT,'Нельзя начислять время после поломки') WHERE NEW.ended_at IS NOT NULL AND EXISTS(SELECT 1 FROM faults f WHERE f.workplace_id=NEW.workplace_id AND (CAST(strftime('%s',substr(NEW.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.started_at,20,1)='.' THEN CAST(substr(substr(NEW.started_at,21,length(NEW.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(f.detected_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(f.detected_at,20,1)='.' THEN CAST(substr(substr(f.detected_at,21,length(f.detected_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) AND (CAST(strftime('%s',substr(f.detected_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(f.detected_at,20,1)='.' THEN CAST(substr(substr(f.detected_at,21,length(f.detected_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)<(CAST(strftime('%s',substr(NEW.ended_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.ended_at,20,1)='.' THEN CAST(substr(substr(NEW.ended_at,21,length(NEW.ended_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
 SELECT RAISE(ABORT,'Завершённый сеанс неизменяем') WHERE OLD.status='completed' AND (NEW.status!=OLD.status OR NEW.booking_id IS NOT OLD.booking_id OR NEW.client_id!=OLD.client_id OR NEW.workplace_id!=OLD.workplace_id OR NEW.tariff_id!=OLD.tariff_id OR NEW.hourly_rate_snapshot!=OLD.hourly_rate_snapshot OR NEW.started_at!=OLD.started_at OR NEW.ended_at IS NOT OLD.ended_at OR NEW.total_amount IS NOT OLD.total_amount OR NEW.end_reason IS NOT OLD.end_reason);
 SELECT RAISE(ABORT,'Активный сеанс нельзя переносить или менять его ставку') WHERE OLD.status='active' AND (NEW.booking_id IS NOT OLD.booking_id OR NEW.client_id!=OLD.client_id OR NEW.workplace_id!=OLD.workplace_id OR NEW.tariff_id!=OLD.tariff_id OR NEW.hourly_rate_snapshot!=OLD.hourly_rate_snapshot OR NEW.started_at!=OLD.started_at);
 SELECT RAISE(ABORT,'Продление неисправного места запрещено') WHERE NEW.status='active' AND NEW.planned_ends_at!=OLD.planned_ends_at AND (SELECT condition FROM workplaces WHERE id=NEW.workplace_id)!='available';
END;

CREATE TRIGGER payment_update BEFORE UPDATE ON payments BEGIN
 SELECT RAISE(ABORT,'Нужна полная оплата завершённого сеанса') WHERE NOT EXISTS(SELECT 1 FROM sessions s WHERE s.id=NEW.session_id AND s.status='completed' AND s.total_amount=NEW.amount AND (CAST(strftime('%s',substr(NEW.paid_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.paid_at,20,1)='.' THEN CAST(substr(substr(NEW.paid_at,21,length(NEW.paid_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>=(CAST(strftime('%s',substr(s.ended_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(s.ended_at,20,1)='.' THEN CAST(substr(substr(s.ended_at,21,length(s.ended_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
END;

CREATE TRIGGER log_update BEFORE UPDATE ON action_log BEGIN
 SELECT RAISE(ABORT,'Не найден объект журнала') WHERE NOT ((NEW.entity_type='roles' AND EXISTS(SELECT 1 FROM roles WHERE id=NEW.entity_id)) OR (NEW.entity_type='staff' AND EXISTS(SELECT 1 FROM staff WHERE id=NEW.entity_id)) OR (NEW.entity_type='staff_roles' AND EXISTS(SELECT 1 FROM staff_roles WHERE id=NEW.entity_id)) OR (NEW.entity_type='clients' AND EXISTS(SELECT 1 FROM clients WHERE id=NEW.entity_id)) OR (NEW.entity_type='zones' AND EXISTS(SELECT 1 FROM zones WHERE id=NEW.entity_id)) OR (NEW.entity_type='categories' AND EXISTS(SELECT 1 FROM categories WHERE id=NEW.entity_id)) OR (NEW.entity_type='workplaces' AND EXISTS(SELECT 1 FROM workplaces WHERE id=NEW.entity_id)) OR (NEW.entity_type='tariffs' AND EXISTS(SELECT 1 FROM tariffs WHERE id=NEW.entity_id)) OR (NEW.entity_type='bookings' AND EXISTS(SELECT 1 FROM bookings WHERE id=NEW.entity_id)) OR (NEW.entity_type='sessions' AND EXISTS(SELECT 1 FROM sessions WHERE id=NEW.entity_id)) OR (NEW.entity_type='payment_methods' AND EXISTS(SELECT 1 FROM payment_methods WHERE id=NEW.entity_id)) OR (NEW.entity_type='payments' AND EXISTS(SELECT 1 FROM payments WHERE id=NEW.entity_id)) OR (NEW.entity_type='faults' AND EXISTS(SELECT 1 FROM faults WHERE id=NEW.entity_id)) OR (NEW.entity_type='action_log' AND EXISTS(SELECT 1 FROM action_log WHERE id=NEW.entity_id)));
 SELECT RAISE(ABORT,'Перенос требует причины и прежних/новых значений') WHERE NEW.action='move' AND (length(trim(coalesce(NEW.reason,'')))=0 OR NEW.old_values='{}' OR NEW.new_values='{}' OR NEW.entity_type!='bookings');
END;

CREATE TRIGGER tariff_history BEFORE UPDATE ON tariffs BEGIN
 SELECT RAISE(ABORT,'Использованная версия тарифа неизменяема') WHERE EXISTS(SELECT 1 FROM sessions WHERE tariff_id=OLD.id) AND (NEW.hourly_rate!=OLD.hourly_rate OR NEW.category_id!=OLD.category_id OR NEW.valid_from!=OLD.valid_from);
 SELECT RAISE(ABORT,'Конец тарифа исключает исторический запуск') WHERE NEW.valid_to IS NOT NULL AND EXISTS(SELECT 1 FROM sessions s WHERE s.tariff_id=OLD.id AND (CAST(strftime('%s',substr(s.started_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(s.started_at,20,1)='.' THEN CAST(substr(substr(s.started_at,21,length(s.started_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>=(CAST(strftime('%s',substr(NEW.valid_to,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.valid_to,20,1)='.' THEN CAST(substr(substr(NEW.valid_to,21,length(NEW.valid_to)-26)||'000000',1,6) AS INTEGER) ELSE 0 END));
END;

CREATE TRIGGER fault_lifecycle BEFORE UPDATE ON faults BEGIN
 SELECT RAISE(ABORT,'Закрытая неисправность не открывается заново') WHERE OLD.status='resolved' AND (NEW.status!='resolved' OR NEW.workplace_id!=OLD.workplace_id OR NEW.detected_at!=OLD.detected_at OR NEW.resolved_at IS NOT OLD.resolved_at);
END;

CREATE TRIGGER place_available BEFORE UPDATE ON workplaces BEGIN
 SELECT RAISE(ABORT,'У места остаётся открытая неисправность') WHERE NEW.condition='available' AND EXISTS(SELECT 1 FROM faults WHERE workplace_id=NEW.id AND status='open');
 SELECT RAISE(ABORT,'Место с историей не меняет категорию или зону') WHERE (NEW.category_id!=OLD.category_id OR NEW.zone_id!=OLD.zone_id) AND (EXISTS(SELECT 1 FROM sessions WHERE workplace_id=OLD.id) OR EXISTS(SELECT 1 FROM bookings WHERE workplace_id=OLD.id));
END;

CREATE TRIGGER fault_open AFTER INSERT ON faults WHEN NEW.status='open' BEGIN
 UPDATE workplaces SET condition='maintenance' WHERE id=NEW.workplace_id;
 UPDATE bookings SET needs_resolution=1,fault_id=NEW.id,changed_at=NEW.detected_at,changed_by=NEW.detected_by
 WHERE workplace_id=NEW.workplace_id AND status='confirmed' AND (CAST(strftime('%s',substr(ends_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(ends_at,20,1)='.' THEN CAST(substr(substr(ends_at,21,length(ends_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END)>(CAST(strftime('%s',substr(NEW.detected_at,1,19)||'+03:00') AS INTEGER)*1000000 + CASE WHEN substr(NEW.detected_at,20,1)='.' THEN CAST(substr(substr(NEW.detected_at,21,length(NEW.detected_at)-26)||'000000',1,6) AS INTEGER) ELSE 0 END) AND NOT EXISTS(SELECT 1 FROM sessions WHERE booking_id=bookings.id);
END;

CREATE TRIGGER fault_resolved AFTER UPDATE OF status ON faults WHEN NEW.status='resolved' BEGIN
 UPDATE workplaces SET condition='available' WHERE id=NEW.workplace_id AND NOT EXISTS(SELECT 1 FROM faults WHERE workplace_id=NEW.workplace_id AND status='open');
END;

CREATE TRIGGER keep_bookings BEFORE DELETE ON bookings BEGIN
 SELECT RAISE(ABORT,'История сохраняется; удаление запрещено') WHERE 1;
END;

CREATE TRIGGER keep_sessions BEFORE DELETE ON sessions BEGIN
 SELECT RAISE(ABORT,'История сохраняется; удаление запрещено') WHERE 1;
END;

CREATE TRIGGER keep_payments BEFORE DELETE ON payments BEGIN
 SELECT RAISE(ABORT,'История сохраняется; удаление запрещено') WHERE 1;
END;

CREATE TRIGGER keep_faults BEFORE DELETE ON faults BEGIN
 SELECT RAISE(ABORT,'История сохраняется; удаление запрещено') WHERE 1;
END;

CREATE TRIGGER keep_action_log BEFORE DELETE ON action_log BEGIN
 SELECT RAISE(ABORT,'История сохраняется; удаление запрещено') WHERE 1;
END;

CREATE TRIGGER log_immutable BEFORE UPDATE ON action_log BEGIN
 SELECT RAISE(ABORT,'Журнал дополняется, существующие события не меняются') WHERE 1;
END;

CREATE VIEW v_revenue AS SELECT date(paid_at,'+3 hours') AS payment_day,method_id,count(*) AS payment_count,sum(CAST(replace(amount,'.','') AS INTEGER)) AS amount_kopecks FROM payments GROUP BY payment_day,method_id;

CREATE VIEW v_unpaid_sessions AS SELECT s.* FROM sessions s LEFT JOIN payments p ON p.session_id=s.id WHERE s.status='completed' AND p.id IS NULL;

CREATE VIEW v_booking_journal AS SELECT b.*,c.full_name AS client_name,w.number AS workplace_number,z.name AS zone_name,k.name AS category_name,t.name AS tariff_name,t.hourly_rate FROM bookings b JOIN clients c ON c.id=b.client_id JOIN workplaces w ON w.id=b.workplace_id JOIN zones z ON z.id=w.zone_id JOIN categories k ON k.id=w.category_id JOIN tariffs t ON t.id=b.tariff_id;
