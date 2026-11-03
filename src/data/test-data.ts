export const validUser = {
  email: 'demo@example.com',
  password: 'Password123!',
} as const;

export const invalidUser = {
  email: 'wrong@example.com',
  password: 'invalid-password',
} as const;

export const expectedCatalog = [
  { id: 101, name: 'Wireless Mouse', category: 'Electronics', priceCents: 2599 },
  { id: 102, name: 'Notebook', category: 'Stationery', priceCents: 899 },
  { id: 103, name: 'Water Bottle', category: 'Lifestyle', priceCents: 1599 },
] as const;
