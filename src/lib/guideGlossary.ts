/** Plain-English meanings for words people see in NEXORA. */

export type GlossaryTerm = {
  term: string
  means: string
  where: string
}

export const GUIDE_GLOSSARY: GlossaryTerm[] = [
  {
    term: 'Sell',
    means: 'The till / checkout screen where you add products and take money.',
    where: 'Sidebar · bottom bar on phones',
  },
  {
    term: 'Cash drawer / float',
    means:
      'The cash in the till at the start. “Opening float” is how much money you put in the drawer before sales.',
    where: 'Sell → shift card',
  },
  {
    term: 'Open shift',
    means:
      'Start a cash session. Tap Open shift after typing the opening float. The system then knows what cash should be in the drawer at the end.',
    where: 'Sell',
  },
  {
    term: 'Close shift',
    means:
      'End the cash session and count the drawer. If counted cash is less than expected, Command can show a short close.',
    where: 'Sell',
  },
  {
    term: 'Complete',
    means: 'Finish the sale: take payment, drop stock, and create a receipt.',
    where: 'Sell · cart',
  },
  {
    term: 'Catalogue / tile',
    means: 'The product buttons you tap to add items. Hold a tile to add five at once.',
    where: 'Sell',
  },
  {
    term: 'Scan / barcode',
    means:
      'Read the product code with a USB gun, phone camera, or by typing the number and pressing Enter.',
    where: 'Sell · search box',
  },
  {
    term: 'Tender / Exact',
    means:
      'Cash the customer gives you. Exact means they paid the total with no change.',
    where: 'Sell · cart',
  },
  {
    term: 'Discount',
    means:
      'Reduce the price. Big discounts need permission and a reason so owners can see patterns.',
    where: 'Sell · cart',
  },
  {
    term: 'Void',
    means:
      'Cancel a finished sale and put stock back. Always write a reason. Sometimes you need a manager PIN.',
    where: 'Ledger · sale detail',
  },
  {
    term: 'Manager PIN',
    means: 'A short code only managers know, used to approve voids or large discounts.',
    where: 'Sell / Ledger when asked',
  },
  {
    term: 'Command',
    means: 'Owner desk: today’s money, branches, leaks, and Trust — “is the shop healthy?”',
    where: 'Sidebar',
  },
  {
    term: 'Pulse',
    means: 'Advisor screen: health score, reorder ideas, ask questions about your shop data.',
    where: 'Sidebar',
  },
  {
    term: 'Trust',
    means:
      'A panel that highlights cashiers or branches with unusual voids or discounts — a soft theft / leak alarm.',
    where: 'Command',
  },
  {
    term: 'Money leaks',
    means:
      'Warnings when profit is at risk: selling below cost, too many discounts, voids, stock shrink.',
    where: 'Command · Pulse',
  },
  {
    term: 'Critical',
    means: 'A serious leak or risk that needs action today (example: selling below cost).',
    where: 'Command · Money leaks',
  },
  {
    term: 'Ledger',
    means: 'List of past sales. Search, reprint receipts, or void with a reason.',
    where: 'Sidebar',
  },
  {
    term: 'Receive (stock)',
    means: 'Add quantity when a delivery arrives so the system matches the shelf.',
    where: 'Inventory · product',
  },
  {
    term: 'Low stock',
    means: 'Quantity at or under the warning level you set — time to reorder.',
    where: 'Inventory · Command',
  },
  {
    term: 'Branch',
    means: 'One physical shop location. “All branches” is Head Office view.',
    where: 'Account strip · Settings',
  },
  {
    term: 'Transfer',
    means: 'Move stock from one branch to another with a written trail.',
    where: 'Transfers',
  },
  {
    term: 'Purchasing',
    means:
      'Buy stock from suppliers with a purchase order (PO): draft → order → receive into a branch.',
    where: 'Sidebar · Purchasing',
  },
  {
    term: 'Purchase order / PO',
    means:
      'A written order to a supplier: which products, how many, and which branch will receive them.',
    where: 'Purchasing',
  },
  {
    term: 'Supplier',
    means: 'A company you buy stock from. Keep phone and notes so reordering is fast.',
    where: 'Suppliers',
  },
  {
    term: 'Pharmacy',
    means:
      'Extra screens for medicine shops: lots (batches), expiry dates, FEFO (oldest first), and Rx notes.',
    where: 'Sidebar · Pharmacy (pharmacy shops only)',
  },
  {
    term: 'Lot / batch',
    means:
      'One delivery group of the same product with its own expiry date. Pharmacies and fresh-food shops use lots.',
    where: 'Pharmacy / Perishables',
  },
  {
    term: 'FEFO',
    means: 'First Expired, First Out — sell or dispense the batch that expires soonest.',
    where: 'Pharmacy · dispense',
  },
  {
    term: 'Rx note',
    means: 'A short prescription note saved with a pharmacy sale when needed.',
    where: 'Sell · pharmacy',
  },
  {
    term: 'Perishables',
    means:
      'Fresh / grocery lot tracking (expiry) without the full pharmacy medicine screens.',
    where: 'Sidebar · Perishables (grocery shops)',
  },
  {
    term: 'Labels',
    means: 'Print barcode stickers for shelves or products from the Labels screen.',
    where: 'Sidebar · Labels',
  },
  {
    term: 'Expenses',
    means: 'Money that left the shop that was not a customer refund — rent, transport, airtime.',
    where: 'Sidebar · Expenses',
  },
  {
    term: 'Team',
    means: 'Invite staff, set roles and permissions, and reset passwords.',
    where: 'Sidebar · Team',
  },
  {
    term: 'Permission',
    means:
      'A specific power on a login — sell, inventory, void, discounts, and so on. Cashiers often get Sell only.',
    where: 'Team',
  },
  {
    term: 'Audit',
    means: 'The diary of who voided, discounted, received stock, or used a PIN.',
    where: 'Sidebar',
  },
  {
    term: 'Conflicts',
    means:
      'Offline sales that fought over the same stock. A manager must choose how to fix it.',
    where: 'Sidebar',
  },
  {
    term: 'Queued / offline',
    means:
      'Sale saved on the device when Wi‑Fi died. It syncs later — do not type the same sale again.',
    where: 'Sell · Online status',
  },
  {
    term: 'Loyalty',
    means: 'Points for regular customers. Look up by phone on Sell before Complete.',
    where: 'Sell · Customers',
  },
  {
    term: 'Credit sale',
    means: 'Customer pays later. Needs permission and a customer with a credit limit.',
    where: 'Sell · payment tiles',
  },
  {
    term: 'Settings',
    means:
      'Shop name on receipts, MoMo numbers, theme, branches, and a link back to this guide.',
    where: 'Sidebar · Settings',
  },
]
