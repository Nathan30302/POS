import 'dotenv/config';
import { prisma } from './prisma.js';
import { hashPassword } from './auth.js';
import { DEFAULT_MODULES } from './constants.js';

async function main() {
  console.log('Seeding NEXORA…');

  const adminHash = await hashPassword('NexoraAdmin1!');
  const ownerHash = await hashPassword('DemoOwner1!');
  const shopAdminHash = await hashPassword('DemoAdmin1!');
  const cashierHash = await hashPassword('DemoCash1!');

  const admin = await prisma.platformUser.upsert({
    where: { email: 'admin@nexora.app' },
    update: {
      passwordHash: adminHash,
      fullName: 'Nexora Super Admin',
      role: 'SUPER_ADMIN',
    },
    create: {
      email: 'admin@nexora.app',
      passwordHash: adminHash,
      fullName: 'Nexora Super Admin',
      role: 'SUPER_ADMIN',
    },
  });
  console.log('Platform admin:', admin.email);

  const business = await prisma.business.upsert({
    where: { slug: 'demo-stationery' },
    update: {
      name: 'Demo Stationery',
      industry: 'stationery',
      currency: 'ZMW',
      status: 'ACTIVE',
      modulesJson: JSON.stringify(DEFAULT_MODULES),
      settingsJson: JSON.stringify({
        onboardingComplete: true,
        paymentMethods: ['CASH', 'CARD', 'MTN_MOMO', 'AIRTEL_MONEY'],
      }),
      plan: 'growth',
    },
    create: {
      name: 'Demo Stationery',
      slug: 'demo-stationery',
      industry: 'stationery',
      currency: 'ZMW',
      status: 'ACTIVE',
      modulesJson: JSON.stringify(DEFAULT_MODULES),
      settingsJson: JSON.stringify({
        onboardingComplete: true,
        paymentMethods: ['CASH', 'CARD', 'MTN_MOMO', 'AIRTEL_MONEY'],
      }),
      plan: 'growth',
      phone: '+260970000001',
      address: 'Cairo Road, Lusaka',
      email: 'hello@demo.shop',
    },
  });
  console.log('Business:', business.name);

  let branch = await prisma.branch.findFirst({
    where: { businessId: business.id, isMain: true },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        businessId: business.id,
        name: 'Main Branch',
        code: 'MAIN',
        isMain: true,
        address: 'Cairo Road, Lusaka',
      },
    });
  }

  let eastBranch = await prisma.branch.findFirst({
    where: { businessId: business.id, code: 'EAST' },
  });
  if (!eastBranch) {
    eastBranch = await prisma.branch.create({
      data: {
        businessId: business.id,
        name: 'East Park kiosk',
        code: 'EAST',
        isMain: false,
        address: 'East Park Mall, Lusaka',
      },
    });
  }

  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.shop' },
    update: {
      passwordHash: ownerHash,
      fullName: 'Demo Owner',
      active: true,
    },
    create: {
      email: 'owner@demo.shop',
      passwordHash: ownerHash,
      fullName: 'Demo Owner',
      phone: '+260970000002',
    },
  });

  const shopAdmin = await prisma.user.upsert({
    where: { email: 'admin@demo.shop' },
    update: {
      passwordHash: shopAdminHash,
      fullName: 'Demo Admin',
      active: true,
    },
    create: {
      email: 'admin@demo.shop',
      passwordHash: shopAdminHash,
      fullName: 'Demo Admin',
      phone: '+260970000004',
    },
  });

  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@demo.shop' },
    update: {
      passwordHash: cashierHash,
      fullName: 'Demo Cashier',
      active: true,
    },
    create: {
      email: 'cashier@demo.shop',
      passwordHash: cashierHash,
      fullName: 'Demo Cashier',
      phone: '+260970000003',
    },
  });

  await prisma.membership.upsert({
    where: { businessId_userId: { businessId: business.id, userId: owner.id } },
    update: {
      role: 'OWNER',
      branchId: branch.id,
      active: true,
      permissions: JSON.stringify([]),
    },
    create: {
      businessId: business.id,
      userId: owner.id,
      branchId: branch.id,
      role: 'OWNER',
      permissions: JSON.stringify([]),
    },
  });

  await prisma.membership.upsert({
    where: { businessId_userId: { businessId: business.id, userId: shopAdmin.id } },
    update: {
      role: 'ADMIN',
      branchId: branch.id,
      active: true,
      permissions: JSON.stringify([]),
    },
    create: {
      businessId: business.id,
      userId: shopAdmin.id,
      branchId: branch.id,
      role: 'ADMIN',
      permissions: JSON.stringify([]),
    },
  });

  await prisma.membership.upsert({
    where: { businessId_userId: { businessId: business.id, userId: cashier.id } },
    update: {
      role: 'CASHIER',
      branchId: branch.id,
      active: true,
      permissions: JSON.stringify(['sell', 'labels']),
    },
    create: {
      businessId: business.id,
      userId: cashier.id,
      branchId: branch.id,
      role: 'CASHIER',
      permissions: JSON.stringify(['sell', 'labels']),
    },
  });

  const categoryNames = ['Writing', 'Paper', 'Filing', 'Art Supplies', 'Office'];
  const categories: Record<string, string> = {};
  for (const name of categoryNames) {
    const cat = await prisma.category.upsert({
      where: { businessId_name: { businessId: business.id, name } },
      update: {},
      create: { businessId: business.id, name },
    });
    categories[name] = cat.id;
  }

  const productDefs = [
    { name: 'Blue Ballpoint Pen', sku: 'PEN-BLU-01', barcode: '6001001001001', category: 'Writing', costPrice: 2, sellingPrice: 5, stock: 120, low: 20 },
    { name: 'Black Ballpoint Pen', sku: 'PEN-BLK-01', barcode: '6001001001002', category: 'Writing', costPrice: 2, sellingPrice: 5, stock: 95, low: 20 },
    { name: 'HB Pencil Pack (12)', sku: 'PEN-HB-12', barcode: '6001001001003', category: 'Writing', costPrice: 8, sellingPrice: 15, stock: 40, low: 10 },
    { name: 'A4 Exercise Book 80pg', sku: 'NB-A4-80', barcode: '6001001002001', category: 'Paper', costPrice: 6, sellingPrice: 12, stock: 200, low: 30 },
    { name: 'A5 Notebook', sku: 'NB-A5-01', barcode: '6001001002002', category: 'Paper', costPrice: 10, sellingPrice: 22, stock: 60, low: 15 },
    { name: 'Printer Paper Ream A4', sku: 'PAP-A4-500', barcode: '6001001002003', category: 'Paper', costPrice: 55, sellingPrice: 85, stock: 25, low: 8 },
    { name: 'Manila Folder Pack (10)', sku: 'FIL-MAN-10', barcode: '6001001003001', category: 'Filing', costPrice: 18, sellingPrice: 35, stock: 35, low: 10 },
    { name: 'Ring Binder A4', sku: 'FIL-RIN-01', barcode: '6001001003002', category: 'Filing', costPrice: 25, sellingPrice: 45, stock: 18, low: 5 },
    { name: 'Colour Pencil Set (24)', sku: 'ART-COL-24', barcode: '6001001004001', category: 'Art Supplies', costPrice: 30, sellingPrice: 55, stock: 22, low: 6 },
    { name: 'Glue Stick 20g', sku: 'ART-GLU-20', barcode: '6001001004002', category: 'Art Supplies', costPrice: 4, sellingPrice: 9, stock: 8, low: 10 },
    { name: 'Stapler Medium', sku: 'OFF-STP-01', barcode: '6001001005001', category: 'Office', costPrice: 28, sellingPrice: 50, stock: 15, low: 5 },
    { name: 'Sticky Notes Pack', sku: 'OFF-STK-01', barcode: '6001001005002', category: 'Office', costPrice: 7, sellingPrice: 14, stock: 50, low: 12 },
  ];

  const products = [];
  for (const def of productDefs) {
    const existing = await prisma.product.findFirst({
      where: { businessId: business.id, sku: def.sku },
    });
    const product = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: def.name,
            barcode: def.barcode,
            categoryId: categories[def.category],
            costPrice: def.costPrice,
            sellingPrice: def.sellingPrice,
            stockQuantity: def.stock,
            lowStockThreshold: def.low,
            active: true,
          },
        })
      : await prisma.product.create({
          data: {
            businessId: business.id,
            name: def.name,
            sku: def.sku,
            barcode: def.barcode,
            categoryId: categories[def.category],
            costPrice: def.costPrice,
            sellingPrice: def.sellingPrice,
            stockQuantity: def.stock,
            lowStockThreshold: def.low,
          },
        });
    products.push(product);
  }
  console.log(`Products: ${products.length}`);

  const existingSales = await prisma.sale.count({ where: { businessId: business.id } });
  if (existingSales === 0) {
    const sale1Items = [
      { product: products[0], quantity: 3 },
      { product: products[3], quantity: 2 },
      { product: products[11], quantity: 1 },
    ];
    const sale1Lines = sale1Items.map(({ product, quantity }) => ({
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice: product.sellingPrice,
      lineTotal: product.sellingPrice * quantity,
      costPrice: product.costPrice,
    }));
    const sale1Sub = sale1Lines.reduce((s, i) => s + i.lineTotal, 0);

    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          businessId: business.id,
          branchId: branch!.id,
          soldById: cashier.id,
          status: 'COMPLETED',
          subtotal: sale1Sub,
          discount: 0,
          tax: 0,
          total: sale1Sub,
          paymentMethod: 'CASH',
          receiptNo: 'R-000001',
          items: { create: sale1Lines },
        },
      });
      for (const line of sale1Lines) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stockQuantity: { decrement: line.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            businessId: business.id,
            productId: line.productId,
            type: 'SALE',
            quantity: -line.quantity,
            note: `Sale ${sale.receiptNo}`,
            referenceId: sale.id,
          },
        });
      }
    });

    const sale2Items = [
      { product: products[5], quantity: 1 },
      { product: products[8], quantity: 1 },
      { product: products[1], quantity: 5 },
    ];
    const sale2Lines = sale2Items.map(({ product, quantity }) => ({
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice: product.sellingPrice,
      lineTotal: product.sellingPrice * quantity,
      costPrice: product.costPrice,
    }));
    const sale2Sub = sale2Lines.reduce((s, i) => s + i.lineTotal, 0);
    const discount = 10;

    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          businessId: business.id,
          branchId: branch!.id,
          soldById: owner.id,
          status: 'COMPLETED',
          subtotal: sale2Sub,
          discount,
          tax: 0,
          total: sale2Sub - discount,
          paymentMethod: 'MTN_MOMO',
          receiptNo: 'R-000002',
          items: { create: sale2Lines },
        },
      });
      for (const line of sale2Lines) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stockQuantity: { decrement: line.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            businessId: business.id,
            productId: line.productId,
            type: 'SALE',
            quantity: -line.quantity,
            note: `Sale ${sale.receiptNo}`,
            referenceId: sale.id,
          },
        });
      }
    });

    console.log('Created 2 demo sales');
  } else {
    console.log(`Sales already present (${existingSales}), skipping sale seed`);
  }

  const oldest = await prisma.sale.findFirst({
    where: { businessId: business.id },
    orderBy: { createdAt: 'asc' },
  });
  const needHistory =
    !oldest ||
    oldest.createdAt > new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1);
  if (needHistory && products.length) {
    const methods = ['CASH', 'MTN_MOMO', 'CARD', 'AIRTEL_MONEY'] as const;
    let receipt = 100;
    for (let monthOffset = 5; monthOffset >= 1; monthOffset--) {
      const salesInMonth = 4 + ((5 - monthOffset) % 3);
      for (let s = 0; s < salesInMonth; s++) {
        const day = 3 + s * 4;
        const when = new Date(
          new Date().getFullYear(),
          new Date().getMonth() - monthOffset,
          Math.min(day, 27),
          10 + (s % 6),
          15,
        );
        const picks = [
          products[s % products.length],
          products[(s + 3) % products.length],
          products[(s + 7) % products.length],
        ];
        const lines = picks.map((product, idx) => {
          const quantity = 1 + ((s + idx + monthOffset) % 4);
          return {
            productId: product.id,
            productName: product.name,
            quantity,
            unitPrice: product.sellingPrice,
            lineTotal: product.sellingPrice * quantity,
            costPrice: product.costPrice,
          };
        });
        const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
        const boost = monthOffset <= 2 ? 1.15 : 1;
        await prisma.sale.create({
          data: {
            businessId: business.id,
            branchId: branch!.id,
            soldById: cashier.id,
            status: 'COMPLETED',
            subtotal,
            discount: s % 4 === 0 ? 5 : 0,
            tax: 0,
            total: Number(((subtotal - (s % 4 === 0 ? 5 : 0)) * boost).toFixed(2)),
            paymentMethod: methods[s % methods.length],
            receiptNo: `H-${String(receipt++).padStart(4, '0')}`,
            createdAt: when,
            updatedAt: when,
            items: { create: lines },
          },
        });
      }
    }
    // recent week vs prior week contrast for movers
    for (const [daysAgo, idxs] of [
      [2, [0, 3, 0]],
      [3, [0, 5, 0]],
      [9, [8, 8, 11]],
      [10, [8, 11, 11]],
    ] as const) {
      const when = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const lines = idxs.map((i) => {
        const product = products[i];
        const quantity = daysAgo < 7 ? 3 : 1;
        return {
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice: product.sellingPrice,
          lineTotal: product.sellingPrice * quantity,
          costPrice: product.costPrice,
        };
      });
      const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
      await prisma.sale.create({
        data: {
          businessId: business.id,
          branchId: branch!.id,
          soldById: owner.id,
          status: 'COMPLETED',
          subtotal,
          discount: 0,
          tax: 0,
          total: subtotal,
          paymentMethod: 'CASH',
          receiptNo: `H-${String(receipt++).padStart(4, '0')}`,
          createdAt: when,
          updatedAt: when,
          items: { create: lines },
        },
      });
    }
    console.log('Backfilled multi-month growth history');
  }

  const customerCount = await prisma.customer.count({
    where: { businessId: business.id },
  });
  if (customerCount === 0) {
    await prisma.customer.createMany({
      data: [
        {
          businessId: business.id,
          fullName: 'Chanda Mwila',
          phone: '+260977111222',
          email: 'chanda@example.com',
          creditLimit: 500,
          loyaltyPts: 40,
          notes: 'Regular — prefers MTN MoMo',
        },
        {
          businessId: business.id,
          fullName: 'Thandiwe Banda',
          phone: '+260966333444',
          creditLimit: 200,
          loyaltyPts: 15,
        },
        {
          businessId: business.id,
          fullName: 'Lusaka Schools Supplies',
          phone: '+260211555666',
          email: 'orders@schools.zm',
          creditLimit: 5000,
          loyaltyPts: 120,
          notes: 'Bulk stationery buyer',
        },
      ],
    });
    console.log('Created demo customers');
  } else {
    console.log(`Customers already present (${customerCount}), skipping`);
  }

  console.log('\nSeed complete.');
  console.log('  Platform: admin@nexora.app / NexoraAdmin1!');
  console.log('  Owner:    owner@demo.shop / DemoOwner1!');
  console.log('  Admin:    admin@demo.shop / DemoAdmin1!');
  console.log('  Cashier:  cashier@demo.shop / DemoCash1!');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
