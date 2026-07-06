if (process.env.HUSKY === '0' || process.env.CI === 'true' || process.env.NODE_ENV === 'production') {
  process.exit(0);
}

try {
  const husky = (await import('husky')).default;
  console.log(husky());
} catch {
  process.exit(0);
}
