import React from "react";
import { StyleSheet, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors } from "../constants/theme";

interface CategoryIconProps {
  category: string;
  size?: number;
  iconSize?: number;
}

export const getCategoryIconName = (category: string): keyof typeof MaterialIcons.glyphMap => {
  const norm = (category || "").toLowerCase().trim();
  if (norm.includes("food") || norm.includes("dining") || norm.includes("restaurant") || norm.includes("cafe")) {
    return "restaurant";
  }
  if (norm.includes("grocer")) {
    return "shopping-basket";
  }
  if (norm.includes("transport") || norm.includes("cab") || norm.includes("taxi") || norm.includes("fuel") || norm.includes("petrol") || norm.includes("auto")) {
    return "directions-car";
  }
  if (norm.includes("shop") || norm.includes("cloth") || norm.includes("apparel") || norm.includes("shoe")) {
    return "shopping-bag";
  }
  if (norm.includes("entertain") || norm.includes("movie") || norm.includes("game") || norm.includes("netflix") || norm.includes("spotify")) {
    return "movie";
  }
  if (norm.includes("bill") || norm.includes("utilit") || norm.includes("electric") || norm.includes("gas") || norm.includes("internet") || norm.includes("phone")) {
    return "receipt-long";
  }
  if (norm.includes("health") || norm.includes("medic") || norm.includes("pharma") || norm.includes("doctor")) {
    return "medical-services";
  }
  if (norm.includes("educat") || norm.includes("course") || norm.includes("book") || norm.includes("tuition")) {
    return "school";
  }
  if (norm.includes("travel") || norm.includes("flight") || norm.includes("hotel") || norm.includes("airbnb") || norm.includes("trip")) {
    return "flight";
  }
  if (norm.includes("person") || norm.includes("care") || norm.includes("salon") || norm.includes("spa")) {
    return "spa";
  }
  return "category";
};

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  size = 40,
  iconSize = 20,
}) => {
  const iconName = getCategoryIconName(category);

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <MaterialIcons name={iconName} size={iconSize} color={Colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
});
