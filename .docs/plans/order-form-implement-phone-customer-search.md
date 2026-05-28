# Order Form Phone Customer Search

## Summary

Implement phone-based customer lookup in the public `OrderForm` so returning customers can have their delivery details filled when no saved browser cookie profile exists.

## Plan

1. Add a public backend customer lookup route scoped by tenant slug and phone number.
2. Return only storefront-safe customer profile fields: name, phone, address, notes, and saved address options.
3. Update tenant RLS resolution for the new public customer route.
4. Add a frontend service and server action for the public lookup.
5. Use React's built-in deferred value pattern for phone search input changes.
6. Control delivery details inputs from `OrderForm` so lookup results can fill them.
7. Auto-fill the address when one saved address is found.
8. Show a multiple-address hint and Bottom Sheet selector when more than one saved address is found.
9. Skip remote lookup when a saved customer profile already exists in the tracking cookie.
10. Run lint/type checking after implementation.
