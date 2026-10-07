# Marvel Chat — Frontend / Backend Integration

This document records the browser integration points for the current Marvel Chat platform implementation.

## Home

The frontend uses the secured Home operations for posts and Moments:

- createPost
- updatePost
- deletePost
- createMoment
- deleteMoment
- reactToPost
- commentOnPost
- savePost

Moments are displayed by active lifetime and the viewer's own/followed identity relationships.

## Chat

The frontend uses:

- createChatThread
- sendMessage
- markThreadRead
- deleteMessage

Chat threads are restricted to their participants. Messages are stored in the thread messages subcollection and the sender identity is controlled by the authenticated request.

## Marvel Skills

Discovery reads active skill listings.

Provider workflows map to the backend operations for skill profiles, listings, requests, offers, completion, deletion, and reviews.

The browser does not invent provider ownership, request status, offer state, or other protected business values.

## Marvel Market

Marketplace discovery uses discoverMarketProducts.

Store, product, inventory, availability, store status, commerce request, and review operations are server authoritative.

The public Market experience is buyer-first. Seller management belongs under Profile → My Business.

## Identity

- ensureUserProfile
- updateProfile
- updateUserSettings
- registerDevice
- unregisterDevice

## Notifications

- getMyNotificationSummary
- markNotificationRead
- dispatchNotificationPush

Browser push requires the production web-push configuration before registration is enabled for public use.

## Search

Universal discovery supports the backend search function with these scopes:

- all
- users
- skills
- market

The UI also provides contextual search experiences inside Home, Chat, Skills, and Market rather than forcing every search into one generic page.

## Media

The backend exposes:

- createMediaUpload
- finalizeMediaUpload
- createMediaReadUrls

The browser media flow remains gated until the live signed-upload contract is tested end-to-end. The frontend must not fabricate signing parameters.

## App Check

Callable functions that enforce App Check require the browser to initialize App Check before protected calls are made.

Production App Check configuration must be completed before public launch.

## Error handling

The frontend translates Firebase Authentication, App Check, Firestore, network, quota, and callable-function errors into member-friendly messages.

## Production certification

Browser end-to-end testing must prove each visible action works against the live backend before the application is published publicly.
