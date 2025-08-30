package knit.demo

import knit.Provides
import knit.di

@Provides
class MemoryGitSystem {
    private val store: MemoryStoreComponent by di

    fun commit(key: String, value: String) {
        println("Committing [$key] = $value to git system")
        store.store(key, value)
    }
}