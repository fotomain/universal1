import { createContext, useContext, useEffect, useState } from "react"
import { Platform } from "react-native"
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite"
import { getUserData } from "../lib/localSecureStorage"

const DbContext = createContext<any>(null)

const SQLiteNativeProvider = (props: any) => {
    const { children, initialConfig, loggedUserId: propLoggedUserId, userId: propUserId } = props
    const [isReadySQLiteDb, setIsReadySQLiteDb] = useState(false)
    const [loggedUserId, setLoggedUserId] = useState<string>(
        propLoggedUserId || propUserId || ""
    )

    useEffect(() => {
        let isMounted = true
        async function fetchUserId() {
            if (propLoggedUserId || propUserId) {
                if (isMounted) setLoggedUserId(propLoggedUserId || propUserId)
                return
            }
            try {
                const userData = await getUserData()
                if (isMounted && userData?.id) {
                    setLoggedUserId(userData.id)
                }
            } catch (err) {
                console.error("Error loading user data for SQLiteNativeProvider:", err)
            }
        }
        fetchUserId()
        return () => { isMounted = false }
    }, [propLoggedUserId, propUserId])

    const constructDbName = (id?: string) => {
        const activeId = id || loggedUserId
        if (activeId) {
            return `sqlite_${activeId}`
        }
        if (props.dbName && props.dbName.startsWith("sqlite_")) {
            return props.dbName
        }
        return `sqlite_${props.dbName || "default"}`
    }

    const [dbAdapter, setdbAdapter] = useState<any>({
        dbName: constructDbName(propLoggedUserId || propUserId),
    })

    useEffect(() => {
        const computedName = constructDbName(loggedUserId)
        setdbAdapter((prev: any) => ({
            ...prev,
            dbName: computedName,
        }))
    }, [loggedUserId, props.dbName])

    const updateDbConfig: any = (newConfig: any) => {
        if (newConfig?.loggedUserId || newConfig?.userId) {
            const uid = newConfig.loggedUserId || newConfig.userId
            setdbAdapter({ dbName: `sqlite_${uid}` })
        } else if (newConfig?.dbName) {
            const name = newConfig.dbName.startsWith("sqlite_") ? newConfig.dbName : `sqlite_${newConfig.dbName}`
            setdbAdapter({ dbName: name })
        }
    }

    const useSQLiteMi = useSQLiteContext
    const value: any = { setIsReadySQLiteDb, isReadySQLiteDb, dbAdapter, updateDbConfig, useSQLiteMi }

    if (Platform.OS === 'web') {
        return (
            <DbContext.Provider value={value}>
                {children}
            </DbContext.Provider>
        )
    }

    return (
        <DbContext.Provider value={value}>
            <SQLiteProvider databaseName={dbAdapter.dbName}>{children}</SQLiteProvider>
        </DbContext.Provider>
    )
}

export const useSQLNative = () => {
    const context = useContext(DbContext)
    if (!context) {
        return null
    }
    return context
}

export default SQLiteNativeProvider
