# One EasyKash merchant, separate products

Live uses the existing merchant account with `glive_<payment UUID>` references and an EGP invoice amount stored as integer piastres. Agent references keep their existing flow. The attached patch adds a product-scoped forwarding branch to Agent's existing account callback, and support for the documented SHA-512 signature while retaining existing legacy signature verification. Live's receiver verifies the full documented signature itself; an unsigned forwarded payload cannot confirm an invoice.

Live additionally uses authenticated server-to-server Payment Inquiry on return and in a bounded background reconciliation job. Browser redirect parameters never confirm a payment. Amount and namespace must match the stored invoice. Partial/ambiguous amounts require admin review. The customer's actual mobile number is required; no fabricated phone number is sent to the provider.

Credentials remain private on the server. During deployment copy only EASYKASH_API_KEY and EASYKASH_HMAC_SECRET from the existing Agent environment into Live's private .env.app; preserve the existing merchant callback URL and all other environment values. No real secret belongs here. The merchant-facing business name is controlled by EasyKash's approved merchant profile; `productName` is a product label, not a promise that the bank-statement merchant name has changed.

DirectPay authorization was checked without creating a checkout: an empty request with the current key reached field validation (460), while the same empty request without a key returned 401. An inquiry for an intentionally unknown reference returned 403; this alone does not prove that the key is invalid. No real charge was attempted.

Refunds: no undocumented refund endpoint is invented. A requested EasyKash refund is placed in the admin review queue; it remains pending until the provider reports REFUNDED. Refunds are matched to the payment that granted a booking so refunding a duplicate cannot revoke the original seat. The released-funds reversal is idempotent. Operator refunds should be initiated from this queue and completed in the merchant dashboard.

Verification includes the official public HMAC fixture, legacy compatibility, strict piastre parsing, fake-gateway end-to-end checks, duplicate callbacks/payments, underpayment, cash vouchers, failed checkouts, authorization and confirmed refunds. Test gateways run only on isolated localhost/private test networks. No bank transaction is part of the smoke tests.

Official sources:
- https://easykash.gitbook.io/easykash-apis-documentation/direct-payment-hosted/pay-api
- https://easykash.gitbook.io/easykash-apis-documentation/direct-payment-hosted/callback-service/callback-response-verification
- https://easykash.gitbook.io/easykash-apis-documentation/direct-payment-hosted/payment-inquiry
