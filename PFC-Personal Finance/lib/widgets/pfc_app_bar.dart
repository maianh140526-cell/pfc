import 'package:flutter/material.dart';

import '../theme/pfc_brand.dart';

class PfcBrandMark extends StatelessWidget {
  const PfcBrandMark({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final iconSize = compact ? 28.0 : 34.0;
    return Semantics(
      label: 'PFC - Personal Finance Club',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _PfcLogoImage(size: iconSize),
          const SizedBox(width: 7),
          Text(
            'PFC',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: PfcBrand.primary,
                  fontWeight: FontWeight.w800,
                  letterSpacing: .4,
                ),
          ),
        ],
      ),
    );
  }
}

class _PfcLogoImage extends StatelessWidget {
  const _PfcLogoImage({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    final sourceSize = size * 1.88;
    return SizedBox(
      width: size,
      height: size,
      child: ClipRect(
        child: OverflowBox(
          alignment: Alignment.topCenter,
          minWidth: sourceSize,
          maxWidth: sourceSize,
          minHeight: sourceSize,
          maxHeight: sourceSize,
          child: Transform.translate(
            offset: Offset(0, -size * .12),
            child: Image.asset(
              'assets/branding/pfc-logo.png',
              width: sourceSize,
              height: sourceSize,
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) => Icon(
                Icons.account_balance_wallet_rounded,
                size: size,
                color: PfcBrand.primary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class PfcAppBar extends StatelessWidget implements PreferredSizeWidget {
  const PfcAppBar({
    super.key,
    required this.title,
    this.actions,
    this.bottom,
  });

  final Widget title;
  final List<Widget>? actions;
  final PreferredSizeWidget? bottom;

  @override
  Size get preferredSize => Size.fromHeight(
        kToolbarHeight + (bottom?.preferredSize.height ?? 0),
      );

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: title,
      titleSpacing: 4,
      actions: [
        ...?actions,
        const Padding(
          padding: EdgeInsets.only(right: 16),
          child: Center(child: PfcBrandMark(compact: true)),
        ),
      ],
      bottom: bottom,
    );
  }
}
