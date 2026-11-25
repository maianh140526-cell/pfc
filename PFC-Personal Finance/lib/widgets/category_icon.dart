import 'package:flutter/material.dart';

const Map<String, IconData> kCategoryIcons = {
  'restaurant': Icons.restaurant,
  'directions_car': Icons.directions_car,
  'shopping_bag': Icons.shopping_bag,
  'home': Icons.home,
  'medical_services': Icons.medical_services,
  'school': Icons.school,
  'sports_esports': Icons.sports_esports,
  'bolt': Icons.bolt,
  'payments': Icons.payments,
  'card_giftcard': Icons.card_giftcard,
  'trending_up': Icons.trending_up,
  'more_horiz': Icons.more_horiz,
  'category': Icons.category,
};

IconData iconFromName(String name) {
  return kCategoryIcons[name] ?? Icons.category;
}
