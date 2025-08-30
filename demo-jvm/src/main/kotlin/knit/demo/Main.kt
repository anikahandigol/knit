package knit.demo

import knit.di

fun main() {
    val monitor: MonitorComponent by di
    val gitSystem: MemoryGitSystem by di

    gitSystem.commit("foo", "bar")
    monitor.monitor("foo")
}