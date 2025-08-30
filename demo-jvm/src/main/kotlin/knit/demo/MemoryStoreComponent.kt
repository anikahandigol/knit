package knit.demo

import knit.Provides

@Provides
class MemoryStoreComponent {
    fun store(key: String, value: String) {
        println("Stored [$key] = $value")
    }
    fun retrieve(key: String): String? {
        println("Retrieving [$key]")
        return null
    }
}