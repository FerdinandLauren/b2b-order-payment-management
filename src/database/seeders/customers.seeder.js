const { now } = require('../../utils/time');

const CUSTOMERS = [
  {
    code: 'CUST-0001',
    name: 'PT Bangun Jaya Konstruksi',
    address: 'Jl. Gatot Subroto No. 88, Kuningan Timur',
    city: 'Jakarta Selatan',
    phone: '021-5290 1188',
    email: 'procurement@bangunjaya.co.id',
    npwp: '01.234.567.8-011.000',
    payment_terms_days: 30,
    credit_limit: 250000000,
  },
  {
    code: 'CUST-0002',
    name: 'CV Sinar Abadi',
    address: 'Jl. Raden Intan No. 45, Tanjung Karang',
    city: 'Bandar Lampung',
    phone: '0721-255 780',
    email: 'admin@sinarabadi.co.id',
    npwp: '02.345.678.9-321.000',
    payment_terms_days: 14,
    credit_limit: 100000000,
  },
  {
    code: 'CUST-0003',
    name: 'PT Nusa Karya Engineering',
    address: 'Jl. Raya Serpong KM 9, BSD',
    city: 'Tangerang Selatan',
    phone: '021-5380 2244',
    email: 'finance@nusakarya.co.id',
    npwp: '03.456.789.0-411.000',
    payment_terms_days: 45,
    credit_limit: 400000000,
  },
  {
    code: 'CUST-0004',
    name: 'Toko Material Sejahtera',
    address: 'Jl. Ahmad Yani No. 12, Bekasi Timur',
    city: 'Bekasi',
    phone: '021-8812 3344',
    email: 'materialsejahtera@gmail.com',
    npwp: '04.567.890.1-407.000',
    payment_terms_days: 7,
    credit_limit: 50000000,
  },
  {
    code: 'CUST-0005',
    name: 'PT Graha Mandiri Utama',
    address: 'Jl. HR Rasuna Said Blok X-5 No. 2',
    city: 'Jakarta Selatan',
    phone: '021-5220 7788',
    email: 'purchasing@grahamandiri.co.id',
    npwp: '05.678.901.2-011.000',
    payment_terms_days: 30,
    credit_limit: 300000000,
  },
  {
    code: 'CUST-0006',
    name: 'CV Mitra Bangunan',
    address: 'Jl. Margonda Raya No. 210, Beji',
    city: 'Depok',
    phone: '021-7721 9900',
    email: 'mitrabangunan@yahoo.co.id',
    npwp: '06.789.012.3-405.000',
    payment_terms_days: 21,
    credit_limit: 75000000,
  },
  {
    code: 'CUST-0007',
    name: 'PT Karya Beton Nusantara',
    address: 'Jl. Raya Cilegon KM 12, Kramatwatu',
    city: 'Serang',
    phone: '0254-390 1122',
    email: 'ap@karyabeton.co.id',
    npwp: '07.890.123.4-418.000',
    payment_terms_days: 60,
    credit_limit: 500000000,
  },
  {
    code: 'CUST-0008',
    name: 'Toko Sumber Rejeki',
    address: 'Jl. Lintas Sumatera KM 32, Natar',
    city: 'Lampung Selatan',
    phone: '0812-7788-9900',
    email: 'sumberrejeki.natar@gmail.com',
    npwp: null,
    payment_terms_days: 0,
    credit_limit: 0,
  },
];

module.exports = function seedCustomers(db) {
  const insert = db.prepare(`
    INSERT INTO customers
      (code, name, address, city, phone, email, npwp, payment_terms_days, credit_limit, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `);

  const timestamp = now();
  for (const customer of CUSTOMERS) {
    insert.run(
      customer.code,
      customer.name,
      customer.address,
      customer.city,
      customer.phone,
      customer.email,
      customer.npwp,
      customer.payment_terms_days,
      customer.credit_limit,
      timestamp,
      timestamp
    );
  }

  // Keep generated codes aligned with the seeded CUST-0001..0008 records.
  db.prepare(
    `INSERT INTO number_counters (entity, year, last_number)
     VALUES ('customer', 'GLOBAL', ?)
     ON CONFLICT(entity, year) DO UPDATE SET last_number = excluded.last_number`
  ).run(CUSTOMERS.length);

  return CUSTOMERS.length;
};

module.exports.CUSTOMERS = CUSTOMERS;
