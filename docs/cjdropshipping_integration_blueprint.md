# CJdropshipping Client Integration & Technical Specification (v2.0)

> **Correction (2026-11-01):** The auth, payment, and webhook examples below are
> outdated. Verified behavior is in `docs/cj-notes.md`: auth is API-key only;
> pay a draft with `POST /shopping/pay/payBalance` (`orderId`) or
> `POST /shopping/pay/payBalanceV2` (`shipmentOrderId`); webhook `sign` is
> `Base64(HMAC-SHA256(openId, rawBody))` and the payload uses
> `messageId`/`type`/`messageType`/`params`. Use `cj-notes.md` for implementation.

> **Target Audience:** Autonomous AI Agents, Integration Engineers, Software Architects.  
> **Purpose:** Detailed operational reference for integrating CJdropshipping APIs, managing order creation workflows, handling payment models, verifying webhooks, and interacting via MCP (Model Context Protocol).

---

## 1. Executive Architecture Overview

The CJdropshipping platform allows client systems (stores, ERPs, AI agents) to automate e-commerce fulfillment. 

```
┌──────────────┐     1. Get Token       ┌──────────────────┐
│              ├───────────────────────►│                  │
│              │     2. Create Order    │  CJdropshipping  │
│   AI Agent   ├───────────────────────►│    API v2.0      │
│  / Client    │     3. Pay Balance     │                  │
│  Integration ├───────────────────────►│                  │
│              │                        └────────┬─────────┘
│              │    4. Webhook Push              │
│              │◄────────────────────────────────┘
└──────────────┘    (Order Status / Tracking)
```

---

## 2. Authentication Protocol

All API calls must include the temporary access token passed via HTTP headers.

* **Base URL:** `https://developers.cjdropshipping.com/api2.0/v1`
* **Header Key:** `CJ-Access-Token`
* **Content-Type:** `application/json`

### Token Acquisition Flow
1. Obtain `apiKey` from **My CJ > Authorization > API**.
2. Call `/authentication/getAccessToken`:
```http
POST /api2.0/v1/authentication/getAccessToken HTTP/1.1
Host: developers.cjdropshipping.com
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "hashed_or_raw_api_key"
}
```
3. Cache the returned token. *Note: Refresh token prior to expiration.*

---

## 3. Order Creation & Integration Flow

Order fulfillment follows a strict sequence: **Validation → Order Creation → Payment Confirmation**.

### 3.1 Order Creation Options (`payType`)
When executing `POST /shopping/order/createOrderV2`:
* **`payType=2`**: Create order AND pay immediately using account CJ Wallet balance.
* **`payType=3`** *(Recommended for AI Control)*: Create order **only** (as draft/unpaid). Allows separate balance validation before deduction.
* *Note: `payType=1` (redirect URL) is deprecated and MUST NOT be used.*

### 3.2 Request Structure (`createOrderV2`)
```json
{
  "orderNumber": "CLIENT-ORDER-100234",
  "payType": 3,
  "shippingCustomerName": "Jane Doe",
  "shippingCountryCode": "US",
  "shippingZip": "90210",
  "shippingCity": "Los Angeles",
  "shippingAddress": "123 Ocean Drive",
  "shippingPhone": "555-0199",
  "logisticName": "CJ Packet Ordinary",
  "products": [
    {
      "vid": "1952652478987366401",
      "sku": "CJJJJTJT00784-Black",
      "quantity": 2
    }
  ]
}
```

---

## 4. Payment Execution Engine

If using `payType=3`, payment must be triggered as a distinct transaction step.

### Step 1: Check Wallet Balance
Before submitting payment, inspect current funds:
* **Endpoint:** `GET /shopping/payment/getBalance`

### Step 2: Execute Balance Payment
* **Endpoint:** `POST /shopping/payment/payBalanceV2`
```json
{
  "orderIdList": [
    "CJ202610310001928"
  ]
}
```

---

## 5. Webhook System & Security Management

CJ sends HTTP POST pushes for status updates, tracking changes, and makeup bills.

### 5.1 Endpoint Configuration
* Set primary endpoint via `POST /webhook/set`
* **Requirements:**
  * Must be a public `HTTPS` endpoint with a valid SSL certificate.
  * Server response time must be **< 3 seconds** with an HTTP `200 OK`.
  * Must return `{"code": 200, "result": true, "message": "success"}`.

### 5.2 Signature Verification (Security)
Every webhook request carries a signature header `sign` to prevent spoofing.

```python
import hmac
import hashlib

def verify_cj_webhook(raw_payload: str, received_signature: str, secret_key: str) -> bool:
    """
    Computes HMAC-SHA256 signature using the raw body string and secret key.
    """
    computed_sig = hmac.new(
        secret_key.encode('utf-8'),
        raw_payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(computed_sig, received_signature)
```

### 5.3 Webhook Payload Schema (`order`)
```json
{
  "type": "order",
  "timestamp": 1793433840000,
  "data": {
    "orderId": "CJ202610310001928",
    "orderNumber": "CLIENT-ORDER-100234",
    "status": "PROCESSING",
    "trackingNumber": "9261290983471209384",
    "logisticName": "USPS Express"
  }
}
```

---

## 6. AI Agent Integration via MCP (Model Context Protocol)

Agents using Claude, ChatGPT, or custom LLM frameworks can consume CJ tools natively through the official CJ MCP Server.

### MCP Configuration Entry
```json
{
  "mcpServers": {
    "cj-dropshipping": {
      "command": "node",
      "args": ["/path/to/api-mcp/dist/mcp-server/index.cjs"],
      "env": {
        "CJ_MCP_TOKEN": "YOUR_MCP_TOKEN_HERE"
      }
    }
  }
}
```

### Key MCP Tools Exposed to Agent:
* `get_balance`: Check remaining client funds.
* `calculate_freight`: Calculate logistics costs prior to order creation.
* `create_order`: Programmatically place an order (`payType=3`).
* `pay_balance`: Settle unpaid CJ order balances.
* `query_order`: Fetch live status and tracking details.