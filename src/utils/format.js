const numberFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function rupiah(value) {
  const number = Number(value || 0);
  return `Rp ${numberFormatter.format(number)}`;
}

function number(value, decimals = 2) {
  const formatter = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
  return formatter.format(Number(value || 0));
}

function date(value) {
  if (!value) return '—';
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
}

function datetime(value) {
  if (!value) return '—';
  const [datePart, timePart = ''] = String(value).split(' ');
  return `${date(datePart)}${timePart ? ` ${timePart.slice(0, 5)}` : ''}`;
}

function percent(value) {
  return `${number(value, 1)}%`;
}

module.exports = { rupiah, number, date, datetime, percent };
