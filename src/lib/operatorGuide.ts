/** Full in-app operator documentation — real UI screens + daily clicks + voice. */

export type GuideDevice = 'desktop' | 'phone'

export type GuideChapter = {
  id: string
  title: string
  who: string
  purpose: string
  /** Longer spoken walkthrough */
  voice: string
  screens: { desktop: string; phone: string }
  /** Exact words on screen + what they mean */
  wordsOnScreen: Array<{ word: string; means: string }>
  /** Click-by-click for a normal day */
  clicks: string[]
  parts: Array<{ name: string; meaning: string }>
  runningExample?: string
  theftSignals?: string[]
  tip?: string
}

const GUIDE_CHAPTERS_UNORDERED: GuideChapter[] = [
  {
    id: 'daily',
    title: 'Your day, start to finish',
    who: 'Everyone',
    purpose:
      'Read this first. One full day in order: morning open → sell → fix mistakes → evening close. Every other chapter explains one screen in more detail.',
    voice:
      'Read this chapter first. Here is a normal day in order. Morning: sign in with your email and password. Open Sell. If you use a cash drawer, type the opening float — that is the money already in the drawer — then tap Open shift. During the day stay on Sell: scan a barcode or tap a product, choose how the customer pays, then tap Complete. The receipt shows your shop name. If Wi‑Fi dies, wait for Queued — do not type the same sale again. If you finished a sale by mistake, go to Ledger, open that sale, tap Void, and write a clear reason. Evening: on Sell, Close shift and count the drawer. Owners and managers: open Command once and read Money leaks and Trust. That is the whole loop. The chapters below explain each screen step by step.',
    screens: {
      desktop: '/docs/guide-screens/sell-desktop.png',
      phone: '/docs/guide-screens/sell-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'Opening float',
        means: 'How much cash is in the drawer before the first customer.',
      },
      {
        word: 'Open shift',
        means: 'Button that starts counting that cash session.',
      },
      {
        word: 'Complete',
        means: 'Finish the sale and print/save the receipt.',
      },
      {
        word: 'Close shift',
        means: 'End of day count — compare expected cash vs what you counted.',
      },
    ],
    clicks: [
      'Open the app → Login → type your email and password → tap Sign in.',
      'On a laptop, use the left sidebar. On a phone, use the bottom bar.',
      'Tap Sell (blue when it is the active screen).',
      'If you see No open shift / CLOSED: type Opening float (example 100) → tap Open shift.',
      'Scan a barcode, or tap the search box → type a product name → press Enter.',
      'Or tap a product tile once (hold the tile to add five).',
      'Optional: type the customer’s phone for loyalty or credit.',
      'In the cart, choose Cash, MoMo, Card, Credit, or Other.',
      'If Cash: tap Exact, or type Cash Received, then tap Complete.',
      'Show the receipt — it prints your shop name.',
      'If Wi‑Fi dies: wait for Queued — do not type the same sale again.',
      'End of day on Sell: Close shift → count the drawer → enter counted cash.',
      'Owner / manager: open Command once → read Money leaks and Trust.',
    ],
    parts: [
      {
        name: 'Morning',
        meaning: 'Sign in, open shift, quick Command glance for owners.',
      },
      {
        name: 'Day',
        meaning: 'Sell loop: add → pay → Complete. Offline queue if needed.',
      },
      {
        name: 'Evening',
        meaning: 'Close shift, check Pulse/Command for leaks.',
      },
    ],
    tip: 'Train every new person on this chapter first — then Sell — before Inventory, Command, or Pulse.',
  },
  {
    id: 'sell',
    title: 'Sell (the till)',
    who: 'Cashiers · Owners',
    purpose:
      'Add products, take money, finish the sale. This is where most of the day happens.',
    voice:
      'You are on Sell. Top card is the live floor. Below, if you see No open shift, type Opening float — the starting cash in the drawer — then press Open shift. The phone QR lets a phone open Sell for camera scanning. Customer phone finds loyalty or credit. The search box is for barcodes or names — press Enter after a full barcode. On the right, the cart shows Subtotal, Discount, Total, and payment tiles: Cash, MTN MoMo, Airtel Money, Card, Credit, Other. Cash Received is what the customer handed you. Exact means they paid the total with no change. Complete finishes the sale. Prices come from the server — you cannot invent a cheaper price.',
    screens: {
      desktop: '/docs/guide-screens/sell-desktop.png',
      phone: '/docs/guide-screens/sell-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'No open shift / CLOSED',
        means: 'Cash session not started yet. Open shift before treating drawer cash as tracked.',
      },
      {
        word: 'Opening float',
        means: 'Starting cash in the drawer (example: K 100).',
      },
      {
        word: 'Open shift',
        means: 'Starts the cash session so end-of-day count has a target.',
      },
      {
        word: 'Link phone / QR',
        means: 'Phone opens Sell to scan with the camera while the laptop stays as the till.',
      },
      {
        word: '097… or name',
        means: 'Customer lookup for loyalty points or credit sales.',
      },
      {
        word: 'Subtotal / Discount / Total',
        means: 'Line prices, optional reduction, amount to collect.',
      },
      {
        word: 'Cash Received',
        means: 'Notes the customer gave you — change prints on the receipt.',
      },
      {
        word: 'Complete / Add items to sell',
        means: 'Finish (or reminder to put products in the cart first).',
      },
    ],
    clicks: [
      'Sidebar (or phone bottom bar) → Sell.',
      'Read the shift card at the top. If it says CLOSED / No open shift, continue.',
      'Tap the Opening float box → type the cash already in the drawer (example: 100).',
      'Tap Open shift. The till is now tracking this cash session.',
      'Optional phone till: open Link phone / QR → scan with a second phone for camera scanning.',
      'Click or tap the search box so the cursor is ready.',
      'Scan with a USB gun, or type the full barcode / name → press Enter.',
      'Or scroll the catalogue → tap a tile once (hold ~1 second to add five).',
      'Wrong line? Use − / + on the cart line, or remove the line.',
      'Optional: type 097… customer phone before paying (loyalty / credit).',
      'Choose a payment tile: Cash, MTN MoMo, Airtel Money, Card, Credit, or Other.',
      'If Cash: tap Exact (no change) or type Cash Received → check change on screen.',
      'If you need a Discount: enter it in Discount, write a reason when asked.',
      'Tap Complete. Wait for success — stock drops and a receipt is ready.',
      'Print, share, or show the receipt. Start the next customer with an empty cart.',
    ],
    parts: [
      {
        name: 'Shift card',
        meaning: 'Tracks drawer money for the day.',
      },
      {
        name: 'Phone Sell',
        meaning: 'Second device for fast scanning.',
      },
      {
        name: 'Cart column',
        meaning: 'Payment and Complete live here — sticky on phones.',
      },
    ],
    runningExample:
      'Cart shows 3 pens, Cash selected, Exact tapped, Complete → stock drops, receipt shows your shop name.',
    tip: 'Big Discount needs permission + a reason. Never invent prices at the till.',
  },
  {
    id: 'command',
    title: 'Command (owner desk)',
    who: 'Owners · Admins',
    purpose:
      'See if the shop is healthy: money in, leaks out, and who looks risky.',
    voice:
      'Command is the owner desk. Across the top: Revenue MTD, Gross profit, Live today, Average ticket. MTD means month to date — from the first of the month until now. Live today is only today’s sales. Branch cards compare Main versus other stores: void percent and discount percent. Money leaks lists risks — Critical means act today, for example Selling below cost. Trust highlights cashiers with odd voids or discounts. Tap through to Ledger filtered to that person. Check Command once every day.',
    screens: {
      desktop: '/docs/guide-screens/command-desktop.png',
      phone: '/docs/guide-screens/command-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'Revenue MTD',
        means: 'Total sales money so far this month.',
      },
      {
        word: 'Gross profit MTD',
        means: 'Sales minus cost of goods — rough profit before expenses.',
      },
      {
        word: 'Live today',
        means: 'Sales and tickets since midnight today.',
      },
      {
        word: 'Avg ticket',
        means: 'Average amount per sale.',
      },
      {
        word: 'Void %',
        means: 'Share of sales that were cancelled. High % can mean mistakes or theft.',
      },
      {
        word: 'Discount %',
        means: 'How much price was reduced. Spikes need a reason.',
      },
      {
        word: 'Money leaks',
        means: 'Warnings that profit is escaping.',
      },
      {
        word: 'Critical',
        means: 'Highest urgency leak — fix or investigate today.',
      },
      {
        word: 'Trust',
        means: 'People or branches with suspicious void/discount patterns.',
      },
    ],
    clicks: [
      'Sidebar → Command (hidden for cashier logins — owners and managers only).',
      'At the top, choose Today, 7 days, or 30 days so the numbers match the question you care about.',
      'Read Revenue MTD, Gross profit, Live today, and Avg ticket left to right.',
      'Scroll branch cards if you have more than one door — compare void % and discount %.',
      'Open Money leaks. Start with any card marked Critical (example: selling below cost).',
      'Follow the Fix / open link on that leak (often Inventory price or Ledger).',
      'Open Trust. Tap a flagged cashier or branch.',
      'You land in Ledger filtered to that person — review voids and big discounts.',
      'Do this once in the morning and once before close. That is the owner desk habit.',
    ],
    parts: [
      {
        name: 'KPI strip',
        meaning: 'Big numbers for the period.',
      },
      {
        name: 'Branch comparison',
        meaning: 'Head Office view across locations.',
      },
      {
        name: 'Leaks + Trust',
        meaning: 'Where “something is off” shows up.',
      },
    ],
    runningExample:
      'Example: Money leaks K 2,035 · 2 signals · 1 Critical “Selling below cost — ALOA (−25%)”. That SKU is sold under healthy margin — fix the sell price or ask who discounted.',
    theftSignals: [
      'Critical selling below cost',
      'One cashier always highest void %',
      'Discount % far above other staff',
      'Branch stock value falling while tickets look tiny',
      'Shifts closing short on cash',
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    who: 'Stock staff · Managers',
    purpose: 'What is on the shelf in the computer — receive deliveries, fix low stock.',
    voice:
      'Inventory is the storeroom on screen. Stock at cost is what you paid for everything on the shelf. Stock at selling is what customers would pay if you sold it all. Search finds name, barcode, or SKU. Add product creates a new item. Receive means a delivery arrived — type how many came in. Low stock means quantity is at or under your warning level. History shows every receive and sale movement.',
    screens: {
      desktop: '/docs/guide-screens/inventory-desktop.png',
      phone: '/docs/guide-screens/inventory-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'Stock at cost',
        means: 'Value of inventory using purchase cost.',
      },
      {
        word: 'Stock at selling',
        means: 'Value if everything sold at list price.',
      },
      {
        word: 'SKU',
        means: 'Your internal product code.',
      },
      {
        word: 'Receive',
        means: 'Add stock from a delivery.',
      },
      {
        word: 'Low stock',
        means: 'At or below the threshold — reorder soon.',
      },
    ],
    clicks: [
      'Sidebar → Inventory (on phones it may say Stock).',
      'Read Stock at cost and Stock at selling at the top — those are shelf values.',
      'Tap the search box → type product name, barcode, or SKU → pick the match.',
      'New item: tap Add product → fill name, sell price, cost, barcode → Save.',
      'Optional: Import CSV if you have a catalogue file from another system.',
      'Open a product card → tap Receive → type how many arrived → confirm.',
      'Check History on that product to see RECEIVE and SALE movements.',
      'If Low stock shows: open the product → raise quantity via Receive, or reorder.',
      'Owners: open Pulse afterward for a reorder list built from the same signals.',
    ],
    parts: [
      {
        name: 'Metric tiles',
        meaning: 'Value and shortcuts.',
      },
      {
        name: 'Search + filter',
        meaning: 'Find items fast.',
      },
      {
        name: 'Product cards',
        meaning: 'Edit, receive, history.',
      },
    ],
    runningExample:
      'Receive 24 pens → card stock rises → History shows RECEIVE. Low-stock warning clears if you were below threshold.',
  },
  {
    id: 'pharmacy',
    title: 'Pharmacy / perishable lots',
    who: 'Pharmacy · grocery fresh · stock staff',
    purpose:
      'Only shops registered as pharmacy, chemist, clinic, or grocery get this. Track batches (lots), expiry, and FEFO — oldest first.',
    voice:
      'This screen appears only when your shop type uses lots. Pharmacy means medicine batches, expiry warnings, FEFO dispensing, and Rx notes on Sell. Grocery perishables track fresh lots without the full medicine tools. Open a product lot, check expiry, receive a new batch when delivery arrives, and dispense the batch that expires soonest.',
    screens: {
      desktop: '/docs/guide-screens/inventory-desktop.png',
      phone: '/docs/guide-screens/inventory-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'Lot / batch',
        means: 'One delivery group of the same product with its own expiry date.',
      },
      {
        word: 'FEFO',
        means: 'First Expired, First Out — use the soonest-expiring batch first.',
      },
      {
        word: 'Rx note',
        means: 'Short prescription note saved with a pharmacy sale when needed.',
      },
      {
        word: 'Expiry',
        means: 'When that batch must not be sold anymore.',
      },
    ],
    clicks: [
      'Confirm your shop type is pharmacy / chemist / clinic or grocery — otherwise this menu is hidden.',
      'Sidebar → Pharmacy (or Perishables on grocery shops).',
      'Find the product → open its lots list.',
      'When a delivery arrives: add / receive a new lot with quantity and expiry date.',
      'On Sell for pharmacy: pick the FEFO lot when the app asks; add an Rx note if required.',
      'Weekly: scan lots nearing expiry and move or return them before they waste.',
    ],
    parts: [
      {
        name: 'Lots list',
        meaning: 'Batches per product with dates.',
      },
      {
        name: 'Dispense / FEFO',
        meaning: 'Sell the right batch first.',
      },
    ],
    tip: 'Retail and stationery shops never see this screen — that is intentional.',
  },
  {
    id: 'transfers',
    title: 'Transfers',
    who: 'Multi-branch managers · stock staff',
    purpose:
      'Move stock from one branch to another with a clear trail: request → approve → dispatch → receive.',
    voice:
      'Transfers are for shops with more than one door. You request stock from a branch that has it, to a branch that is short. Someone with approve permission accepts. Dispatch sends the goods. The receiving branch taps receive and enters what actually arrived. Inventory history keeps both sides honest.',
    screens: {
      desktop: '/docs/guide-screens/inventory-desktop.png',
      phone: '/docs/guide-screens/inventory-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'From / To',
        means: 'Sending branch and receiving branch.',
      },
      {
        word: 'Request',
        means: 'Ask for products and quantities to move.',
      },
      {
        word: 'Approve',
        means: 'Manager accepts the request before stock leaves.',
      },
      {
        word: 'Dispatch',
        means: 'Mark that the goods left the sending branch.',
      },
      {
        word: 'Receive',
        means: 'Confirm quantities that arrived at the destination.',
      },
    ],
    clicks: [
      'You need at least two branches under Settings → Branches.',
      'Sidebar → Transfers.',
      'New transfer request → choose From branch and To branch.',
      'Select a product → type quantity → add the line (repeat for more products).',
      'Submit the request.',
      'Approver: open the transfer → Approve.',
      'Sender: Dispatch when the goods leave.',
      'Receiver: open Receive → enter arrived quantities → confirm.',
      'Check Inventory at both branches — counts should match the transfer.',
    ],
    parts: [
      {
        name: 'Request form',
        meaning: 'Create the move.',
      },
      {
        name: 'Transfer list',
        meaning: 'Status of every move in flight.',
      },
    ],
    tip: 'Never move stock between branches only on paper — always finish Receive in the app.',
  },
  {
    id: 'purchasing',
    title: 'Purchasing',
    who: 'Owners · inventory managers',
    purpose:
      'Buy stock from suppliers with a purchase order: draft → ordered → receive into a branch.',
    voice:
      'Purchasing is Head Office buying. Pick or create a supplier, choose which branch will receive the goods, add product lines and quantities, save a draft, then mark it ordered when you place the order. When the truck arrives, receive the PO so Inventory rises. Use Suppliers first if you need vendor phones and notes.',
    screens: {
      desktop: '/docs/guide-screens/inventory-desktop.png',
      phone: '/docs/guide-screens/inventory-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'Purchase order / PO',
        means: 'Written order: supplier, products, quantities, destination branch.',
      },
      {
        word: 'Draft',
        means: 'Not sent yet — you can still edit lines.',
      },
      {
        word: 'Ordered',
        means: 'You have placed the order with the supplier.',
      },
      {
        word: 'Receive into branch',
        means: 'Which shop’s stock will rise when goods arrive.',
      },
    ],
    clicks: [
      'Sidebar → Purchasing (needs inventory permission).',
      'Optional: open Manage suppliers first and add the vendor.',
      'New purchase order → pick Supplier (or type a new supplier name).',
      'Choose Receive into branch.',
      'Add product lines and quantities → save as draft.',
      'When you place the order with the vendor: mark Ordered.',
      'When goods arrive: open the PO → Receive → confirm quantities.',
      'Check Inventory — on-hand counts should rise.',
    ],
    parts: [
      {
        name: 'PO form',
        meaning: 'Build the order.',
      },
      {
        name: 'PO list',
        meaning: 'Drafts, ordered, and received history.',
      },
    ],
    runningExample:
      'Draft 10 cartons of soft drink to Main → Ordered → Receive 10 → Main stock rises by 10.',
  },
  {
    id: 'suppliers',
    title: 'Suppliers',
    who: 'Owners · inventory managers',
    purpose: 'Keep the people you buy from — names, phones, notes — ready for Purchasing.',
    voice:
      'Suppliers is your vendor book. Add each company you buy from. Link them when you create a purchase order so you do not retype the name every time. Keep a phone and a short note — payment terms or delivery days help the next person who reorders.',
    screens: {
      desktop: '/docs/guide-screens/inventory-desktop.png',
      phone: '/docs/guide-screens/inventory-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'Supplier',
        means: 'A company you buy stock from.',
      },
      {
        word: 'Add supplier',
        means: 'Create a new vendor record.',
      },
    ],
    clicks: [
      'Sidebar → Suppliers.',
      'Add supplier → name, phone, notes → save.',
      'Edit a row if the phone or terms change.',
      'Go to Purchasing → New purchase order → pick that supplier from the list.',
    ],
    parts: [
      {
        name: 'Supplier list',
        meaning: 'Everyone you buy from.',
      },
      {
        name: 'Link to Purchasing',
        meaning: 'Same vendors on the PO form.',
      },
    ],
  },
  {
    id: 'ledger',
    title: 'Ledger',
    who: 'Managers · Owners · staff with ledger permission',
    purpose: 'Find an old sale, reprint a receipt, or void a mistake with a reason.',
    voice:
      'Ledger is the sales diary. Chips at the top pick Today, seven days, thirty days, or All. Search looks for cashier names or notes. Payment filter shows only Cash or MoMo and so on. Showing and Total summarise what is on screen. Tap a sale to open detail — reprint for a customer, or Void. Void means cancel that finished sale and put stock back. Always type a reason. Sometimes the app asks for Manager PIN — that is a secret code only managers know.',
    screens: {
      desktop: '/docs/guide-screens/ledger-desktop.png',
      phone: '/docs/guide-screens/ledger-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'Today / 7 days / 30 days',
        means: 'Which sales appear in the list.',
      },
      {
        word: 'Search receipt, cashier, or note',
        means: 'Find one sale quickly.',
      },
      {
        word: 'All payments',
        means: 'Filter by Cash, MoMo, Card, etc.',
      },
      {
        word: 'Void',
        means: 'Cancel the sale after it was completed.',
      },
      {
        word: 'Manager PIN',
        means: 'Approval code for sensitive voids or discounts.',
      },
    ],
    clicks: [
      'Sidebar → Ledger (Sales on some phone labels).',
      'Tap a date chip — start with Today so the list is short.',
      'Optional: open Search → type cashier name, receipt hint, or note.',
      'Optional: set payment filter to Cash or MoMo if you are hunting one tender.',
      'Tap a sale row → read the lines, tender, and cashier.',
      'Reprint if the customer needs a copy.',
      'If the sale was wrong and you have void permission: Void → type a clear reason → confirm.',
      'Enter Manager PIN if the app asks. Stock returns; Audit records the void.',
    ],
    parts: [
      {
        name: 'Filters',
        meaning: 'Date, search, payment.',
      },
      {
        name: 'Sale list',
        meaning: 'Each finished ticket.',
      },
    ],
    theftSignals: [
      'Many voids by one cashier the same afternoon',
      'Void right after a large cash sale',
      'Trust link opens Ledger filtered to one person — review every void',
    ],
  },
  {
    id: 'pulse',
    title: 'Pulse',
    who: 'Owners · Managers',
    purpose: 'Early warnings and advice — health, reorders, ask-your-shop questions.',
    voice:
      'Pulse is the advisor next to Command. Refresh Pulse after a busy day. Health score shows if the shop is cooling off. Leak cards repeat integrity risks. Reorder suggestions list what to buy. Ask lets you type a plain question like what sold best this week. Use Pulse with Command — desk plus advisor.',
    screens: {
      desktop: '/docs/guide-screens/pulse-desktop.png',
      phone: '/docs/guide-screens/pulse-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'Health',
        means: 'Overall shop condition over recent days.',
      },
      {
        word: 'Refresh Pulse',
        means: 'Reload the latest signals.',
      },
      {
        word: 'Reorder',
        means: 'Products that look like they need buying.',
      },
      {
        word: 'Ask',
        means: 'Type a question in normal English about your data.',
      },
    ],
    clicks: [
      'Sidebar → Pulse.',
      'Tap Refresh Pulse.',
      'Read health and leak cards.',
      'Open reorder suggestions before Purchasing.',
      'Try Ask with a simple question.',
    ],
    parts: [
      {
        name: 'Health + leaks',
        meaning: 'How the shop feels; integrity risks.',
      },
      {
        name: 'Reorder + Ask',
        meaning: 'What to buy; questions in plain language.',
      },
    ],
  },
  {
    id: 'customers',
    title: 'Customers',
    who: 'Cashiers · Managers',
    purpose: 'Save regulars for loyalty and credit — look them up by phone on Sell.',
    voice:
      'Customers stores phones and names. Credit outstanding is money customers still owe. Overdue means they are late. On Sell, type their phone before Complete so loyalty or credit applies. Do not keep raising credit if overdue is climbing.',
    screens: {
      desktop: '/docs/guide-screens/customers-desktop.png',
      phone: '/docs/guide-screens/customers-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'Credit outstanding',
        means: 'Total still owed by customers.',
      },
      {
        word: 'Overdue',
        means: 'Balances unpaid longer than your rule allows.',
      },
      {
        word: 'Loyalty points',
        means: 'Rewards for repeat buyers — often applied on Sell.',
      },
    ],
    clicks: [
      'Sidebar → Customers → Add customer.',
      'Enter name + phone → save.',
      'Set credit limit only if you sell on account.',
      'On Sell: type that phone before Complete.',
      'Weekly: open Customers → check overdue list.',
    ],
    parts: [
      {
        name: 'Credit cards',
        meaning: 'Totals and risk.',
      },
      {
        name: 'Search + list',
        meaning: 'Find and open a profile.',
      },
    ],
  },
  {
    id: 'team',
    title: 'Team',
    who: 'Owners · Admins',
    purpose: 'Who can sign in, and what they are allowed to do.',
    voice:
      'Team is the key ring. Invite a cashier with Sell permission only if that is all they should do. Managers may get Ledger, void, and discounts. Manager PIN is a short code for approving risky actions. Reset password if someone is locked out. Three locks against theft: permissions, reasons on voids, and Trust patterns.',
    screens: {
      desktop: '/docs/guide-screens/team-desktop.png',
      phone: '/docs/guide-screens/team-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'Role',
        means: 'Owner, Admin, Cashier, etc. — the job title that sets default powers.',
      },
      {
        word: 'Permission',
        means: 'A specific power like sell, ledger, or discounts.',
      },
      {
        word: 'Manager PIN',
        means: 'Code required for some voids or big discounts.',
      },
    ],
    clicks: [
      'Sidebar → Team → invite / add staff.',
      'Pick role → review permissions.',
      'Save → staff signs in with that email.',
      'Set or rotate manager PIN in your shop’s PIN settings.',
    ],
    parts: [
      {
        name: 'Staff list',
        meaning: 'Who exists.',
      },
      {
        name: 'Invite form',
        meaning: 'Create access carefully.',
      },
    ],
  },
  {
    id: 'expenses',
    title: 'Expenses',
    who: 'Owners · Accountants',
    purpose: 'Record money that left the shop that was not a customer refund.',
    voice:
      'Expenses are rent, transport, airtime, and similar costs. Recording them makes profit honest: sales minus real costs. Tap Record expense, enter amount, category, and a short note. Export CSV if your accountant needs a file.',
    screens: {
      desktop: '/docs/guide-screens/expenses-desktop.png',
      phone: '/docs/guide-screens/expenses-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'Record expense',
        means: 'Add a new cost entry.',
      },
      {
        word: 'Category',
        means: 'Type of cost — rent, transport, and so on.',
      },
    ],
    clicks: [
      'Sidebar → Expenses.',
      'Record expense → amount, category, note → save.',
      'Optional: Export CSV.',
    ],
    parts: [
      {
        name: 'Summary',
        meaning: 'Totals for the period.',
      },
      {
        name: 'List + form',
        meaning: 'History and new entries.',
      },
    ],
  },
  {
    id: 'audit',
    title: 'Audit',
    who: 'Owners · Admins',
    purpose: 'The diary: who did what, when — voids, stock, PIN attempts.',
    voice:
      'Audit is the diary that is hard to erase. When Trust looks strange, open Audit around that time. You will see who voided, who discounted, who received stock, and PIN failures. Compare with Ledger and Conflicts after offline days.',
    screens: {
      desktop: '/docs/guide-screens/audit-desktop.png',
      phone: '/docs/guide-screens/audit-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'Event / action',
        means: 'One logged thing that happened — void, sale, receive, etc.',
      },
      {
        word: 'Actor',
        means: 'Which signed-in user did it.',
      },
    ],
    clicks: [
      'From Trust or a dispute → Sidebar → Audit.',
      'Scroll or filter to the time of the problem.',
      'Open related Ledger sale if needed.',
      'Check Conflicts if the day was offline.',
    ],
    parts: [
      {
        name: 'Event list',
        meaning: 'Time-ordered diary.',
      },
    ],
    theftSignals: [
      'Void clusters for one user',
      'Receive stock with no delivery story',
      'PIN failures then a successful void',
    ],
  },
  {
    id: 'conflicts',
    title: 'Conflicts',
    who: 'Managers · Owners',
    purpose:
      'Fix offline sales that fought over the same stock after the network came back.',
    voice:
      'Conflicts appear when two devices sold or changed the same stock while offline. The app cannot guess which story is true. Open Conflicts, read both sides, pick the correct quantity or cancel the bad ticket, then confirm. Check Audit and Ledger afterward so the diary matches the shelf.',
    screens: {
      desktop: '/docs/guide-screens/audit-desktop.png',
      phone: '/docs/guide-screens/audit-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'Conflict',
        means: 'Two offline actions that disagree about the same stock.',
      },
      {
        word: 'Resolve',
        means: 'Choose the correct outcome so counts match reality.',
      },
    ],
    clicks: [
      'After a day with Queued / offline sales, open Sidebar → Conflicts if it shows a badge.',
      'Open each conflict → read both sides (devices / quantities).',
      'Choose the resolution that matches the real shelf.',
      'Confirm → check Inventory quantity for that product.',
      'Open Audit around the same time to verify who synced what.',
    ],
    parts: [
      {
        name: 'Conflict list',
        meaning: 'Unresolved offline fights.',
      },
      {
        name: 'Resolve panel',
        meaning: 'Pick the true stock story.',
      },
    ],
    tip: 'Train cashiers: never retype a queued sale — that creates conflicts.',
  },
  {
    id: 'settings',
    title: 'Settings',
    who: 'Owners · Admins',
    purpose:
      'Shop name on every receipt, phone and address under that name, MoMo numbers, look, branches, How to use.',
    voice:
      'Settings is identity. The Business name is what prints large at the top of every receipt — that is your shop name, not the word NEXORA. Phone and address print under the shop name when you fill them in. MoMo agent numbers show on Sell for customers who pay by mobile money. Themes change how the app looks. Branches create extra locations. Your shops switches if you belong to more than one business. Open How to use anytime for this guide with voice.',
    screens: {
      desktop: '/docs/guide-screens/settings-desktop.png',
      phone: '/docs/guide-screens/settings-phone.png',
    },
    wordsOnScreen: [
      {
        word: 'Business profile',
        means: 'Legal-facing shop details for receipts.',
      },
      {
        word: 'Landing look',
        means: 'How the public homepage accents appear.',
      },
      {
        word: 'Branches',
        means: 'Other physical locations under this business.',
      },
    ],
    clicks: [
      'Sidebar → Settings.',
      'Edit business name → Save.',
      'Add MoMo numbers if you use them.',
      'Create branches if you have more than one counter.',
      'Open How to use to train staff.',
    ],
    parts: [
      {
        name: 'Profile',
        meaning: 'Name and contact.',
      },
      {
        name: 'Look + branches',
        meaning: 'Appearance and locations.',
      },
    ],
  },
]

/** Learning order: day → till → stock → buy → history → owner tools → admin. */
const GUIDE_READING_ORDER = [
  'daily',
  'sell',
  'inventory',
  'pharmacy',
  'transfers',
  'purchasing',
  'suppliers',
  'ledger',
  'command',
  'pulse',
  'customers',
  'expenses',
  'team',
  'audit',
  'conflicts',
  'settings',
] as const

export const GUIDE_CHAPTERS: GuideChapter[] = (() => {
  const map = new Map(GUIDE_CHAPTERS_UNORDERED.map((c) => [c.id, c]))
  const ordered: GuideChapter[] = []
  for (const id of GUIDE_READING_ORDER) {
    const chapter = map.get(id)
    if (chapter) {
      ordered.push(chapter)
      map.delete(id)
    }
  }
  for (const chapter of map.values()) ordered.push(chapter)
  return ordered
})()

export const GUIDE_TOC = GUIDE_CHAPTERS.map((c) => ({
  id: c.id,
  title: c.title,
  who: c.who,
}))
