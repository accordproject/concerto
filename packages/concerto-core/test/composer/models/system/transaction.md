The base *transaction* is implicitly extended by all other transactions. *Transaction* is an **abstract** meaning that no instances of it can be created, however, it does contain the *transactionId* property, which is extended to all other transactions.

```
abstract transaction Transaction identified by transactionId {
  o String transactionId
```
