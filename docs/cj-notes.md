# CJ Dropshipping API notes

Verified against the official CJ developer docs on 2026-10-31:

- https://developers.cjdropshipping.com/en/api/api2/api/auth.html
- https://developers.cjdropshipping.com/en/api/api2/api/product.html
- https://developers.cjdropshipping.com/en/api/api2/api/shopping.html
- https://developers.cjdropshipping.com/en/api/api2/api/logistic.html
- https://developers.cjdropshipping.com/en/api/api2/standard/ps-code.html
- https://developers.cjdropshipping.com/en/api/start/limit.html

## Connection

- Base URL: `https://developers.cjdropshipping.com/api2.0/v1`
- Auth header on every authenticated call: `CJ-Access-Token: <accessToken>`
- Auth is **API-key only**. There is no email/password login.
- `CJ_EMAIL` is not used. Do not add it.
- Keep `CJ_API_KEY` in Supabase function secrets. The Next.js app does not need it
  and `.env.local` must not contain CJ credentials.

## Authentication

### Get access token

`POST /authentication/getAccessToken`

```json
{ "apiKey": "CJUserNum@api@..." }
```

Response `data`:

```json
{
  "openId": 123456789,
  "accessToken": "...",
  "accessTokenExpiryDate": "2021-08-18T09:16:33+08:00",
  "refreshToken": "...",
  "refreshTokenExpiryDate": "2022-02-07T09:16:33+08:00",
  "createDate": "2021-08-11T09:16:33+08:00"
}
```

- Access token life: 180 days.
- Refresh token life: 180 days.
- Calling getAccessToken repeatedly within 24 hours returns the same tokens
  (server-side cache).
- QPS for auth: 1 request/second.

### Refresh access token

`POST /authentication/refreshAccessToken`

```json
{ "refreshToken": "..." }
```

Returns the same `data` shape. If the refresh token is invalid, CJ returns code
`1600003`; get a new access token with the API key.

### Logout

`POST /authentication/logout` with `CJ-Access-Token`. Invalidates both tokens.

## Response envelope

Success and failure both use HTTP 200, so check `code`/`result`, not only HTTP
status:

```json
{
  "code": 200,
  "result": true,
  "message": "Success",
  "data": {},
  "requestId": "...",
  "success": true
}
```

`requestId` is useful when contacting CJ support. Message text can change; code
values are stable.

## Rate limits and transient errors

- Free / level 0-1 accounts: 1 request/second.
- Plus / level 2: 2 req/s. Prime / level 3: 4 req/s. Advanced / level 4-5: 6 req/s.
- Also: max 10 requests/second per IP, max 30 req/s on non-login endpoints.
- CJ now uses a daily points quota. Check the current points rules in the docs.
- `1600200`: too many requests. Retry with backoff.
- `1600201`: daily quota used up. Do not retry in a loop.
- `1600000`: system busy. Retry later.
- `1600301`: read timed out. Retry later.
- `1600001` / `1600002`: invalid or empty access token. Refresh or re-auth once.

Relevant permanent errors:

- `1600300`: parameter error.
- `1602000` / `1602001`: variant or product not found.
- `1602002` / `1602003`: product or variant removed from shelves.
- `1603003`: order already exists (safe to treat as an idempotent create).
- `1604000`: insufficient CJ balance.
- `1604001`: balance payment temporarily restricted.

## Products

### Search/list products

`GET /product/listV2`

Useful query parameters:

| Parameter | Notes |
| --- | --- |
| `keyWord` | Name or SKU keyword |
| `page` | 1-1000, default 1 |
| `size` | 1-100, default 10 |
| `categoryId` | Third-level category ID |
| `countryCode` | e.g. `US`, only products with inventory there |
| `startSellPrice`, `endSellPrice` | Price range |
| `sort` | `asc` or `desc` (default `desc`) |
| `orderBy` | `0` best match, `1` listing count, `2` sell price, `3` create time, `4` inventory |
| `features` | Repeatable: `enable_description`, `enable_category`, `enable_combine`, `enable_video` |

Response shape:

```json
{
  "code": 200,
  "result": true,
  "data": {
    "pageSize": 20,
    "pageNumber": 1,
    "totalRecords": 1000,
    "totalPages": 50,
    "content": [
      {
        "productList": [
          {
            "id": "04A22450-...",
            "nameEn": "Product name",
            "sku": "CJNSSYWY01847",
            "spu": "CJNSSYWY01847",
            "bigImage": "https://...",
            "sellPrice": "11.85",
            "nowPrice": "9.50",
            "listedNum": 100,
            "categoryId": "...",
            "warehouseInventoryNum": 500,
            "saleStatus": "3",
            "authorityStatus": "1"
          }
        ],
        "relatedCategoryList": [],
        "keyWord": "hoodie"
      }
    ]
  }
}
```

Notes:

- Results are in `data.content[].productList[]`.
- This endpoint returns summaries only. It does **not** return all variants.
- Prices can be strings, numbers, or ranges (e.g. `"2.97-5.99"`). Keep the raw
  value and parse when needed; do not assume a single number.
- `saleStatus = 3` means approved / on sale.

### Product detail with variants

`GET /product/query`

Provide exactly one of `pid`, `productSku`, or `variantSku`. Optional:

- `features`: `enable_combine`, `enable_video`
- `countryCode`: only return variants with inventory there

Important response fields:

```json
{
  "data": {
    "pid": "000B9312-...",
    "productNameEn": "Small trailer model",
    "productSku": "CJJJJTJT05843",
    "bigImage": "https://...",
    "productImageSet": ["https://..."],
    "productWeight": "1500.0",
    "categoryId": "...",
    "categoryName": "...",
    "sellPrice": 58.09,
    "description": "<html>...</html>",
    "status": "3",
    "variants": [
      {
        "vid": "D4057F56-...",
        "pid": "000B9312-...",
        "variantNameEn": "Small trailer model Black",
        "variantSku": "CJJJJTJT05843-Black",
        "variantKey": "Black-XXL",
        "variantLength": 300,
        "variantWidth": 200,
        "variantHeight": 100,
        "variantWeight": 1580.0,
        "variantSellPrice": 58.09,
        "variantSugSellPrice": 0.97,
        "inventories": [
          {
            "countryCode": "CN",
            "totalInventory": 12912,
            "cjInventory": 0,
            "factoryInventory": 12912,
            "verifiedWarehouse": 2
          }
        ]
      }
    ]
  }
}
```

Notes:

- `variantKey` is the **value combination** (e.g. `Black-XXL`), joined with `-`.
- Use `variantSellPrice` as the CJ cost for that variant.
- Dimensions are usually millimetres and weight is grams in this endpoint.
- `productWeight` and `packingWeight` can be ranges (e.g. `"444.00-3884.00"`),
  even though the field table calls them numbers. Keep the raw value.
- Inventory is per country in `variants[].inventories[]`; it can be missing or
  empty for some products.
- `productImageSet` and some numeric fields can be null/omitted.

### Newer product detail endpoint (not used yet)

`POST /product/productDetail/query` with `{ "id": "<pid>" }` returns 137 fields
including `stanProducts`, `variantInventory`, certifications, and wholesale
prices. The response mixes casing (`nameen`, `sellprice`, `bigimg`,
`variantkeyen`, `authoritystatus`) with camelCase. Do not assume the older
`/product/query` field names apply here. We use `/product/query` for imports
because it already returns variants and inventory.

## Orders

### Create order V2

`POST /shopping/order/createOrderV2`

Payment modes:

- `payType=2`: create and pay from CJ balance in one call.
- `payType=3`: create only; call `POST /shopping/pay/payBalanceV2` later.
- `payType=1`: legacy page payment, deprecated. Do not use.

Minimal body:

```json
{
  "orderNumber": "ST-1001",
  "shippingZip": "10001",
  "shippingCountryCode": "US",
  "shippingCountry": "United States",
  "shippingProvince": "NY",
  "shippingCity": "New York",
  "shippingPhone": "5551234567",
  "shippingCustomerName": "Customer Name",
  "shippingAddress": "123 Main St",
  "shippingAddress2": "",
  "email": "customer@example.com",
  "logisticName": "CJPacket Ordinary",
  "fromCountryCode": "CN",
  "payType": 2,
  "isSandbox": 0,
  "products": [
    {
      "vid": "92511400-C758-4474-93CA-66D442F5F787",
      "quantity": 1,
      "storeLineItemId": "line-1"
    }
  ]
}
```

- `orderNumber` is required and max 50 chars. Use our own order number so retries
  are idempotent.
- CJ requires `shippingCountry`, `shippingProvince`, `shippingCity`,
  `shippingCustomerName`, `shippingAddress`, `logisticName`, and
  `fromCountryCode` even though some are semantically optional for a given
  address.
- Each product needs `vid` or `sku`. `vid` is preferred.
- `orderFlow=1` uses CJ variants (default); `orderFlow=2` uses store SKUs.
- `platform` defaults to API. Set it only if there is a reason.
- `isSandbox=1` creates a sandbox order. Use it for end-to-end tests if enabled
  on the account.

Response `data` (amounts are USD strings/numbers):

```json
{
  "orderId": "123434",
  "orderNumber": "...",
  "shipmentOrderId": "...",
  "orderStatus": "...",
  "postageAmount": "...",
  "productAmount": "...",
  "actualPayment": "...",
  "cjPayUrl": "",
  "productInfoList": []
}
```

- The returned `orderId` is the CJ order ID. If the VID is not a CJ SKU, the ID
  can change; use the webhook or `getOrderDetail` later.
- Duplicate create returns `1603003`. Re-query the custom `orderNumber` and reuse
  the existing order instead of creating another one.

### Query order

`GET /shopping/order/getOrderDetail?orderId=<CJ order id or our orderNumber>`

Optional repeatable `features=LOGISTICS_TIMELINESS`.

Response fields we use:

- `orderId`, `orderNum` (custom order number), `cjOrderId`, `cjOrderCode`
- `orderStatus`, `subStatus`
- `orderAmount`, `productAmount`, `postageAmount`, `currency`
- `logisticName`, `trackNumber`, `trackingProvider`, `trackingUrl`
- `createDate`, `paymentDate`, `outWarehouseTime`, `isComplete`
- `productList[]` with `vid`, `quantity`, `sellPrice`, `storeLineItemId`

Order status values:

- `CREATED`, `IN_CART`, `UNPAID`
- `PENDING` / `PROCESSING` (sub-statuses of `UNSHIPPED`)
- `UNSHIPPED`
- `SHIPPED`
- `DELIVERED`
- `CANCELLED`

### Balance

`GET /shopping/pay/getBalance`

```json
{ "amount": 87247.32, "noWithdrawalAmount": null, "freezeAmount": null }
```

`1604000` means insufficient balance.

## Logistics

### Freight calculation

`POST /logistic/freightCalculate`

```json
{
  "startCountryCode": "CN",
  "endCountryCode": "US",
  "products": [{ "quantity": 2, "vid": "439FC05B-..." }]
}
```

Returns an array with `logisticName`, `logisticPrice` (USD), `logisticAging`
(e.g. `"2-5"`), and optional `taxesFee`, `clearanceOperationFee`,
`totalPostageFee`.

### Tracking

`GET /logistic/trackInfo?trackNumber=A&trackNumber=B`

Response `data` is an array:

```json
{
  "trackingNumber": "CJPKL7160102171YQ",
  "logisticName": "CJPacket Sensitive",
  "trackingFrom": "CN",
  "trackingTo": "US",
  "deliveryDay": "13",
  "deliveryTime": "2021-06-17 07:04:04",
  "trackingStatus": "In transit",
  "lastMileCarrier": "CJPacket",
  "lastTrackNumber": "926112903032124"
}
```

`trackingStatus` is free text, not a stable enum. Keep the raw value and map only
known statuses for the customer timeline.

## Implementation in this repo

- Shared client: `supabase/functions/_shared/cj/`
  - `client.ts`: auth, token refresh, 1 req/s gate, 15 s timeout, retries with
    exponential backoff and jitter, typed errors.
  - `products.ts`: `searchProducts`, `getProduct`.
  - `orders.ts`: `createOrder`, `getOrder`, `getBalance`.
  - `tracking.ts`: `getTrackingInfo`.
  - `supabase-token-store.ts`: reads/writes `supplier_tokens` with the
    service-role client.
  - `factory.ts`: `createCjClient()` reads `CJ_API_KEY` from function secrets.
- Local smoke test: `scripts/cj-smoke.ts`. It uses an in-memory token store and
  the API key from the shell environment.
- The client retries HTTP 429/5xx, CJ `1600000`, `1600200`, and `1600301`.
  It refreshes/re-auths once for `1600001` / `1600002`.
- Access tokens are refreshed when they are within 24 hours of expiry. If the
  refresh token is expired or invalid, the client gets a new access token with
  the API key.
- Order creation uses our `orderNumber` as the idempotency key and treats CJ
  `1603003` as an existing order.

## Commands

Set the key as a Supabase secret for deployed functions:

```bash
npx supabase secrets set CJ_API_KEY=... --project-ref <project-ref>
```

Run the local smoke test (PowerShell):

```powershell
$env:CJ_API_KEY="..."
npm run cj:smoke
```

Optional keyword filter:

```powershell
$env:CJ_SMOKE_KEYWORD="hoodie"
npm run cj:smoke
```

The smoke test prints the CJ balance, then 5 products with their variant IDs,
SKUs, variant labels, and prices.

## Open items

- The smoke test passes against the live CJ account. The account balance is
  `$0.00`, so paid CJ order placement will fail until the owner tops up.
- Product import uses `/product/listV2` for search and `/product/query` for
  detail. Import stores CJ `pid`/`vid` and `cost_price` in `supplier_variants`;
  supplier costs are never returned by public storefront queries.
- CJ product prices and weights may be ranges (for example `"2.97-5.99"` or
  `"444.00-3884.00"`). The importer uses the first numeric value as the cost.
- CJ account level determines QPS. The client defaults to 1 req/s, which is safe
  for free/level 0-1 accounts. Multi-product imports reuse one client so requests
  remain serialized.
- Order webhooks are not covered by this step. Step 8 will add fulfillment, and
  step 9 will add tracking polling.
