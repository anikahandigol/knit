<img width="945" height="375" alt="image" src="https://github.com/user-attachments/assets/dd8942cd-c3ae-4011-acc9-c30f0d066023" />


# KnitNeedle

KnitNeedle is a dependency injection visualisation framework built directly on top of Knit, utilising interactive graphs to map out dependency relationships, flag out errors, all from the comfort of your own IDE. KnitNeedle is lightning fast, informative, and packed with optimisations to keep things moving.

## Optimistic Logging

KnitNeedle improves upon Knit's internal logging system -- Knit does not produce a JSON dump if compilation was unsuccessful, meaning that such errors are not very visible to the user. To solve this issue, KnitNeedle employs **optimistic logging** -- meaning that even if dependency injection errors occur, the exact classes that led to the flagged issue(s) appear in the JSON dump and visualised.

<img width="446" height="345" alt="image" src="https://github.com/user-attachments/assets/9a311036-9000-45a4-9f1c-ac76917697b2" />


## Upstream Errors

This provides KnitNeedle with the unique ability to include errored classes in its dependency visualisation, and therefore also show **affected upstream classes**. This is reflected in the visualised dependency graph, which provides programmers a clear view of what classes are affected, and how to quickly resolve such issues.

<img width="269" height="303" alt="image" src="https://github.com/user-attachments/assets/41b1246b-ca49-4b93-835b-f51515d6f82e" />


## Instant Feedback System

KnitNeedle quickly updates dependency graphs in response to code changes -- by taking advantage of Kotlin's **incremental compilation** capabilities, KnitNeedle builds upon Knit's logging system to only capture logs for parts of the codebase that have to be recompiled. This offers a significant speed increase, as KnitNeedle no longer has to traverse the whole codebase just to update a small set of nodes -- a big plus for large codebases.



## Basic Usage

```kotlin
@Provides
class User(val name: String) // Producer

class UserService(
    @Provides val name: String // Producer which can provide `String`
) {
    val user: User by di // Consumer which need a `User`
}

fun main() {
    val userService = UserService("foo")
    val user = userService.user // User("foo")
}
```

There are 2 basic concepts in Knit:

- `@Provides`, producers should be marked with `@Provides`, it means this member can be used to provide something.
- `by di`, consumers should be marked with `by di`, marked properties should be injected by dependency injection.

In the previous case:

- `User` has been marked with `@Provides`, it means `User` provides its constructor as a dependency provider, and this
  provider needs a `String` provided to construct a `User`.
- `UserService` has a constructor which needs a `String` and it also provides this type inside `UserService`.
- `UserService.user` can be injected through provided `User` constructor and provided parameter `name`.
- For `UserService` call-site, the only thing needs to do is construct it like a normal constructor call, and access its
  member directly.

## Disclaimer
KnitNeedle is a fork of the original Knit repository.
