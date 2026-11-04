export const validUser = {
  email: 'demo@example.com',
  password: 'Password123!',
} as const;

export const invalidUser = {
  email: 'wrong@example.com',
  password: 'invalid-password',
} as const;

export const expectedCatalog = [
  { id: 101, name: 'Wireless Mouse', category: 'Electronics', pricePaise: 259900 },
  { id: 102, name: 'Notebook', category: 'Stationery', pricePaise: 89900 },
  { id: 103, name: 'Water Bottle', category: 'Lifestyle', pricePaise: 159900 },
] as const;
