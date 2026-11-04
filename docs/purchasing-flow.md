# Companies & Inward

Products & Rates is the master catalogue for product names, units, packaging and images. Companies & Inward does not create, rename or replace master products.

Owners create a company with manager details, then see all active master products in its catalogue. Activate a product to allow receiving it from that company. Purchase rates default to the master purchase price and can be edited for the company. Tray rate edits recalculate the loose-piece rate; whole Box/Case receiving exposes only the configured unit quantity.

Deactivate hides the product from Stock Receive and preserves its company rates. Reactivating restores those rates. Global product deactivation and company deletion also block receiving. Existing stock and historical purchases remain.

The catalogue uses suppliers.product_rates with per-product is_active flags. Legacy entries without the flag remain active. supplier_product_rates is synchronized transactionally. Only existing tenant-owned active master IDs can be activated through the catalogue API. No migration or financial-data reset is required.

Store Receive fetches fresh company data and that company's active products. Server-side membership, activity, rates, whole-unit/piece quantities and receipt retry checks protect stock updates.

Purchase History filters by company, its products, and inclusive dates. The screen and A4 print show Date, Product name, Qty, Rate, Total amount and a grand total. Original received amounts are preserved; mixed tray/piece receipts identify an effective average rate where necessary. The product dropdown lists only currently active master products activated for the selected active company. The current brand report starts with empty date filters and includes only receipts for products currently active for that brand. Inactive older purchases remain stored unchanged, but are excluded from this active-products view. Date filters can be changed for earlier receipts of active products.

The isolated company-purchasing and company-purchasing-browser tests verify activation, deactivation, rate/image preservation, receiving, exact stock changes, history filters and A4 output.
