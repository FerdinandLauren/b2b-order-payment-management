const {
  request,
  createApp,
  setupTestDb,
  teardownTestDb,
  loginAs,
} = require('../helpers');

describe('Authentication and RBAC', () => {
  let app;

  beforeAll(() => {
    setupTestDb();
    app = createApp();
  });

  afterAll(() => {
    teardownTestDb();
  });

  test('renders the login page', async () => {
    const response = await request(app).get('/login').expect(200);
    expect(response.text).toContain('Sign in to your workspace');
  });

  test('redirects unauthenticated users to the login page', async () => {
    const response = await request(app).get('/dashboard').expect(302);
    expect(response.headers.location).toBe('/login');
  });

  test('rejects invalid credentials and shows a safe error', async () => {
    const agent = request.agent(app);
    const response = await agent
      .post('/login')
      .type('form')
      .send({ username: 'sales', password: 'wrong-password' })
      .expect(302);

    expect(response.headers.location).toBe('/dashboard');

    const loginPage = await agent.get('/login').expect(200);
    expect(loginPage.text).toContain('Invalid username or password');
  });

  test('signs in and redirects to the dashboard', async () => {
    const agent = await loginAs(app, 'sales', 'sales123');
    const response = await agent.get('/dashboard').expect(200);
    expect(response.text).toContain('Sales workspace');
    expect(response.text).toContain('Siti Nurhaliza');
  });

  test('blocks a sales user from user management', async () => {
    const agent = await loginAs(app, 'sales', 'sales123');
    await agent.get('/users').expect(403);
  });

  test('allows the admin to manage users', async () => {
    const agent = await loginAs(app, 'admin', 'admin123');
    const response = await agent.get('/users').expect(200);
    expect(response.text).toContain('Users &amp; roles');
    expect(response.text).toContain('Siti Nurhaliza');
  });

  test('admin can create a user and the new user can sign in', async () => {
    const admin = await loginAs(app, 'admin', 'admin123');

    await admin
      .post('/users')
      .type('form')
      .send({
        username: 'new.sales',
        fullName: 'Andi Wijaya',
        role: 'sales_staff',
        password: 'secret123',
      })
      .expect(302);

    const agent = await loginAs(app, 'new.sales', 'secret123');
    const response = await agent.get('/dashboard').expect(200);
    expect(response.text).toContain('Andi Wijaya');
  });

  test('admin cannot deactivate their own account', async () => {
    const admin = await loginAs(app, 'admin', 'admin123');
    const me = await admin.get('/users').expect(200);
    const match = me.text.match(/\/users\/(\d+)\/edit/);
    expect(match).toBeTruthy();

    const response = await admin
      .post(`/users/${match[1]}/status`)
      .type('form')
      .send({ status: 'inactive' })
      .expect(302);

    const usersPage = await admin.get(response.headers.location).expect(200);
    expect(usersPage.text).toContain('You cannot deactivate your own account');
  });

  test('signs out and protects the dashboard again', async () => {
    const agent = await loginAs(app, 'finance', 'finance123');
    await agent.post('/logout').type('form').send({}).expect(302);
    await agent.get('/dashboard').expect(302);
  });
});
