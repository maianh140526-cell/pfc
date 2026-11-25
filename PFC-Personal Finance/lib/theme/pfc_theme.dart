import 'package:flutter/material.dart';

import 'pfc_brand.dart';

abstract final class PfcTheme {
  static ThemeData get light {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: PfcBrand.primary,
      brightness: Brightness.light,
      surface: PfcBrand.surface,
      error: PfcBrand.expense,
    ).copyWith(
      primary: PfcBrand.primary,
      onPrimary: Colors.white,
      primaryContainer: PfcBrand.primarySoft,
      onPrimaryContainer: PfcBrand.text,
      secondary: PfcBrand.university,
      onSecondary: Colors.white,
      surface: PfcBrand.surface,
      onSurface: PfcBrand.text,
      onSurfaceVariant: PfcBrand.muted,
      outline: PfcBrand.border,
      outlineVariant: PfcBrand.border,
      error: PfcBrand.expense,
      errorContainer: PfcBrand.expenseSoft,
      onErrorContainer: PfcBrand.expense,
    );

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: PfcBrand.background,
    );

    final controlShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(PfcBrand.controlRadius),
    );

    return base.copyWith(
      appBarTheme: const AppBarTheme(
        backgroundColor: PfcBrand.background,
        foregroundColor: PfcBrand.text,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleTextStyle: TextStyle(
          color: PfcBrand.text,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
      ),
      cardTheme: CardThemeData(
        color: PfcBrand.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 1,
        shadowColor: PfcBrand.text.withValues(alpha: 0.10),
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(PfcBrand.cardRadius),
          side: const BorderSide(color: PfcBrand.border),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: PfcBrand.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(PfcBrand.controlRadius),
          borderSide: const BorderSide(color: PfcBrand.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(PfcBrand.controlRadius),
          borderSide: const BorderSide(color: PfcBrand.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(PfcBrand.controlRadius),
          borderSide: const BorderSide(color: PfcBrand.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(PfcBrand.controlRadius),
          borderSide: const BorderSide(color: PfcBrand.expense),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(PfcBrand.controlRadius),
          borderSide: const BorderSide(color: PfcBrand.expense, width: 2),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: PfcBrand.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, PfcBrand.minTouchTarget),
          shape: controlShape,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: PfcBrand.primary,
          minimumSize: const Size(0, PfcBrand.minTouchTarget),
          side: const BorderSide(color: PfcBrand.primary),
          shape: controlShape,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: PfcBrand.primary,
          minimumSize: const Size(0, PfcBrand.minTouchTarget),
          shape: controlShape,
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: PfcBrand.primary,
        foregroundColor: Colors.white,
        elevation: 4,
      ),
      dividerTheme: const DividerThemeData(
        color: PfcBrand.border,
        thickness: 1,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: PfcBrand.text,
        contentTextStyle: const TextStyle(color: Colors.white),
        shape: controlShape,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: PfcBrand.primary,
        linearTrackColor: PfcBrand.primarySoft,
      ),
      listTileTheme: const ListTileThemeData(
        iconColor: PfcBrand.primary,
        textColor: PfcBrand.text,
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      ),
      tabBarTheme: TabBarThemeData(
        indicatorSize: TabBarIndicatorSize.tab,
        dividerColor: Colors.transparent,
        labelColor: Colors.white,
        unselectedLabelColor: PfcBrand.muted,
        labelStyle: const TextStyle(fontWeight: FontWeight.w600),
        indicator: BoxDecoration(
          color: PfcBrand.primary,
          borderRadius: BorderRadius.circular(PfcBrand.controlRadius),
        ),
      ),
      textTheme: base.textTheme.apply(
        bodyColor: PfcBrand.text,
        displayColor: PfcBrand.text,
      ),
    );
  }
}
