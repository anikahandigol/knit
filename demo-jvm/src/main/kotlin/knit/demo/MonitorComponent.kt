package knit.demo

import knit.Provides
import knit.di

@Provides
class MonitorComponent {
    private val store: MemoryStoreComponent by di

    fun monitor(key: String) {
        println("Monitoring key: $key")
        val value = store.retrieve(key)
        println("Value: $value")
    }
}