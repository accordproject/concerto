The base *event* is implicitly extended by all other events. *Event* is an **abstract** meaning that no instances of it can be created, however, it does contain the *eventId* property, which is extended to all other events.

```
abstract event Event identified by eventId {
  o String eventId
}
```
