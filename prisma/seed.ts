import { PrismaClient, PaymentMethod, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const products = [
  {
    name: "Black Gel Pen 0.7mm",
    barcode: "6001234567001",
    sku: "PEN-BLK-07",
    price: 8.5,
    stockQty: 120,
    reorderLevel: 20,
    category: "Writing",
    imageUrl: "/products/pen-black.jpg",
  },
  {
    name: "Blue Gel Pen 0.7mm",
    barcode: "6001234567002",
    sku: "PEN-BLU-07",
    price: 8.5,
    stockQty: 95,
    reorderLevel: 20,
    category: "Writing",
    imageUrl: "/products/pen-blue.jpg",
  },
  {
    name: "HB Pencils Pack of 12",
    barcode: "6001234567003",
    sku: "PENCIL-HB-12",
    price: 25,
    stockQty: 48,
    reorderLevel: 15,
    category: "Writing",
    imageUrl: "/products/pencils.jpg",
  },
  {
    name: "Exercise Book A4 96pg",
    barcode: "6001234567004",
    sku: "EXB-A4-96",
    price: 18,
    stockQty: 200,
    reorderLevel: 40,
    category: "Books",
    imageUrl: "/products/exercise-book.jpg",
  },
  {
    name: "A4 Paper Ream 500 sheets",
    barcode: "6001234567005",
    sku: "A4-REAM-80",
    price: 95,
    stockQty: 6,
    reorderLevel: 8,
    category: "Paper",
    imageUrl: "/products/a4-paper.jpg",
  },
  {
    name: "30cm Plastic Ruler",
    barcode: "6001234567006",
    sku: "RULER-30",
    price: 7,
    stockQty: 80,
    reorderLevel: 15,
    category: "Tools",
    imageUrl: "/products/ruler.jpg",
  },
  {
    name: "Glue Stick 21g",
    barcode: "6001234567007",
    sku: "GLUE-21",
    price: 12,
    stockQty: 55,
    reorderLevel: 12,
    category: "Adhesives",
    imageUrl: "/products/glue.jpg",
  },
  {
    name: "Mathematical Set",
    barcode: "6001234567008",
    sku: "MATH-SET",
    price: 45,
    stockQty: 32,
    reorderLevel: 10,
    category: "School",
    imageUrl: "/products/math-set.jpg",
  },
  {
    name: "Wax Crayons 12 colours",
    barcode: "6001234567009",
    sku: "CRAYON-12",
    price: 22,
    stockQty: 8,
    reorderLevel: 12,
    category: "Art",
    imageUrl: "/products/crayons.jpg",
  },
  {
    name: "Highlighter Set (4)",
    barcode: "6001234567010",
    sku: "HIGH-4",
    price: 35,
    stockQty: 40,
    reorderLevel: 10,
    category: "Writing",
    imageUrl: "/products/highlighters.jpg",
  },
  {
    name: "Desktop Stapler",
    barcode: "6001234567011",
    sku: "STAPLER",
    price: 55,
    stockQty: 18,
    reorderLevel: 5,
    category: "Office",
    imageUrl: "/products/stapler.jpg",
  },
  {
    name: "Sticky Notes Yellow",
    barcode: "6001234567012",
    sku: "STICKY-Y",
    price: 15,
    stockQty: 60,
    reorderLevel: 15,
    category: "Office",
    imageUrl: "/products/sticky-notes.jpg",
  },
  {
    name: "Desktop Calculator",
    barcode: "6001234567013",
    sku: "CALC-BASIC",
    price: 85,
    stockQty: 14,
    reorderLevel: 5,
    category: "Office",
    imageUrl: "/products/calculator.jpg",
  },
  {
    name: "Office Scissors",
    barcode: "6001234567014",
    sku: "SCISSORS",
    price: 28,
    stockQty: 25,
    reorderLevel: 8,
    category: "Tools",
    imageUrl: "/products/scissors.jpg",
  },
  {
    name: "Ring Binder A4 Blue",
    barcode: "6001234567015",
    sku: "BINDER-BLU",
    price: 42,
    stockQty: 22,
    reorderLevel: 8,
    category: "Files",
    imageUrl: "/products/binder.jpg",
  },
  {
    name: "Manila Folders Pack of 10",
    barcode: "6001234567016",
    sku: "FOLDER-10",
    price: 30,
    stockQty: 35,
    reorderLevel: 10,
    category: "Files",
    imageUrl: "/products/folders.jpg",
  },
  {
    name: "Permanent Marker Black",
    barcode: "6001234567017",
    sku: "MARKER-BLK",
    price: 10,
    stockQty: 70,
    reorderLevel: 15,
    category: "Writing",
    imageUrl: "/products/marker.jpg",
  },
  {
    name: "White Eraser Soft",
    barcode: "6001234567018",
    sku: "ERASER",
    price: 5,
    stockQty: 150,
    reorderLevel: 30,
    category: "Writing",
    imageUrl: "/products/eraser.jpg",
  },
  {
    name: "Metal Pencil Sharpener",
    barcode: "6001234567019",
    sku: "SHARPENER",
    price: 6,
    stockQty: 4,
    reorderLevel: 15,
    category: "Tools",
    imageUrl: "/products/sharpener.jpg",
  },
  {
    name: "Correction Tape",
    barcode: "6001234567020",
    sku: "CORR-TAPE",
    price: 18,
    stockQty: 28,
    reorderLevel: 10,
    category: "Office",
    imageUrl: "/products/correction-tape.jpg",
  },
];

async function main() {
  await prisma.payment.deleteMany();
  await prisma.saleLine.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.shop.deleteMany();

  const shop = await prisma.shop.create({
    data: { name: "Main Shop" },
  });

  const passwordHash = await bcrypt.hash("demo1234", 10);

  const owner = await prisma.user.create({
    data: {
      email: "owner@pos.local",
      name: "Shop Owner",
      passwordHash,
      role: Role.OWNER,
      shopId: shop.id,
    },
  });

  const cashier = await prisma.user.create({
    data: {
      email: "cashier@pos.local",
      name: "Mary Cashier",
      passwordHash,
      role: Role.CASHIER,
      shopId: shop.id,
    },
  });

  const createdProducts = [];
  for (const p of products) {
    const product = await prisma.product.create({
      data: { ...p, shopId: shop.id },
    });
    createdProducts.push(product);
  }

  const sampleSales = [
    {
      lines: [
        { product: createdProducts[0], qty: 2 },
        { product: createdProducts[3], qty: 1 },
        { product: createdProducts[5], qty: 1 },
      ],
      method: PaymentMethod.CASH,
      hoursAgo: 2,
    },
    {
      lines: [
        { product: createdProducts[4], qty: 2 },
        { product: createdProducts[10], qty: 1 },
      ],
      method: PaymentMethod.AIRTEL,
      hoursAgo: 4,
      reference: "AIR-4821",
    },
    {
      lines: [
        { product: createdProducts[2], qty: 1 },
        { product: createdProducts[7], qty: 1 },
        { product: createdProducts[8], qty: 1 },
        { product: createdProducts[17], qty: 2 },
      ],
      method: PaymentMethod.MTN,
      hoursAgo: 5,
      reference: "MTN-9910",
    },
    {
      lines: [
        { product: createdProducts[3], qty: 6 },
        { product: createdProducts[1], qty: 4 },
      ],
      method: PaymentMethod.CASH,
      hoursAgo: 1,
    },
    {
      lines: [
        { product: createdProducts[12], qty: 1 },
        { product: createdProducts[11], qty: 2 },
      ],
      method: PaymentMethod.ZAMTEL,
      hoursAgo: 3,
      reference: "ZAM-2201",
    },
  ];

  for (const sample of sampleSales) {
    const total = sample.lines.reduce(
      (sum, line) => sum + line.product.price * line.qty,
      0
    );
    const createdAt = new Date(Date.now() - sample.hoursAgo * 60 * 60 * 1000);

    await prisma.sale.create({
      data: {
        shopId: shop.id,
        cashierId: cashier.id,
        total,
        createdAt,
        lines: {
          create: sample.lines.map((line) => ({
            productId: line.product.id,
            qty: line.qty,
            unitPrice: line.product.price,
          })),
        },
        payments: {
          create: [
            {
              method: sample.method,
              amount: total,
              reference: sample.reference ?? null,
            },
          ],
        },
      },
    });
  }

  console.log("Seeded Main Shop");
  console.log("Owner:   owner@pos.local / demo1234");
  console.log("Cashier: cashier@pos.local / demo1234");
  console.log(`Products: ${createdProducts.length}`);
  console.log(`Owner id: ${owner.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
