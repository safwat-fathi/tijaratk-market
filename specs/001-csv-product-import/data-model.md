# Data Model: CSV Product Import and Export

This feature does not introduce new database tables, but it relies heavily on the existing `Product` and `Store` entities.

## Target Entity: `Product`

When parsing the CSV, we map columns to the `Product` entity.

**Required CSV Columns (Minimum for creation)**:
- `name` (String)
- `price` (Decimal/Float)
- `category` (String, category name to be resolved to an ID)

**Optional CSV Columns**:
- `description` (String)
- `stock` (Int)
- `imageUrl` (String)

## Validation Rules
- **Format**: File must be `text/csv`.
- **Size**: Maximum 5MB.
- **Content**: Required fields must not be empty. Price must be a valid number > 0. Stock must be an integer >= 0.

## Target Entity: `ProductPriceHistory`
- Tracks the history of price changes when a product's price is updated during the upsert process.

## Business Logic / State Transitions
- **Category Auto-Creation**: If the parsed `category` name does not exist in the database, a new category is created automatically during the import process.
- **Upserting & Price Tracking**: If a product with the same `name` exists in the target `storeId`, it is updated. If the new price differs from the existing price, a `ProductPriceHistory` entry is generated.
- **Number Normalization**: Arabic numerals in numeric fields must be normalized to English numerals during processing.
- **Error Accumulation**: The parser will validate all rows and return an array of errors (e.g., "Row 5: Missing price") alongside the count of updated, added, and failed rows.
