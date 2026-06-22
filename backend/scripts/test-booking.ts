import { prisma } from '../src/config/database.js';

async function main() {
  try {
    const booking = await prisma.serviceBooking.create({
      data: { branchId: 1, notes: 'test script' },
    });
    console.log('OK', booking.id);
  } catch (e) {
    console.error('FAIL', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
