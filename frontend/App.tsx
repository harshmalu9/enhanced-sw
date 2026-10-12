import React, { useState, useCallback } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";
import { Colors } from "./constants/theme";
import { TopAppBar } from "./components/TopAppBar";
import { BottomNavBar, NavTab } from "./components/BottomNavBar";
import { DashboardView } from "./components/DashboardView";
import { ExpensesScreen } from "./components/ExpensesScreen";
import { SplitBillScreen } from "./components/SplitBillScreen";
import { SpendingInsightsView } from "./components/SpendingInsightsView";

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleDataMutated = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const getAppBarTitle = () => {
    switch (activeTab) {
      case "home":
        return "Home";
      case "expenses":
        return "Expenses";
      case "split":
        return "Split & Groups";
      case "insights":
        return "Insights";
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        {/* Material 3 Top App Bar without redundant buttons */}
        <TopAppBar
          title={getAppBarTitle()}
        />

        {/* Main Screen Content Area */}
        <View style={styles.contentArea}>
          {activeTab === "home" && (
            <DashboardView
              onNavigateToTab={(tab) => setActiveTab(tab)}
              onOpenAddExpense={() => {
                setActiveTab("expenses");
                setIsAddExpenseOpen(true);
              }}
              refreshTrigger={refreshTrigger}
            />
          )}

          {activeTab === "expenses" && (
            <ExpensesScreen
              isAddExpenseOpen={isAddExpenseOpen}
              onOpenAddExpense={() => setIsAddExpenseOpen(true)}
              onCloseAddExpense={() => setIsAddExpenseOpen(false)}
              onDataMutated={handleDataMutated}
              refreshTrigger={refreshTrigger}
            />
          )}

          {activeTab === "split" && (
            <SplitBillScreen
              onDataMutated={handleDataMutated}
              onNavigateToExpenses={() => setActiveTab("expenses")}
            />
          )}

          {activeTab === "insights" && (
            <SpendingInsightsView
              onOpenAddExpense={() => {
                setActiveTab("expenses");
                setIsAddExpenseOpen(true);
              }}
              refreshTrigger={refreshTrigger}
            />
          )}
        </View>

        {/* Material 3 Bottom Navigation Bar */}
        <BottomNavBar
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentArea: {
    flex: 1,
  },
});
