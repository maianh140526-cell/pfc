import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../widgets/pfc_app_bar.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _authService = AuthService();

  bool _isLoading = false;
  bool _hideCurrentPassword = true;
  bool _hideNewPassword = true;
  bool _hideConfirmPassword = true;
  String? _serviceError;

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _changePassword() async {
    setState(() => _serviceError = null);
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      await _authService.changePassword(
        _currentPasswordController.text,
        _newPasswordController.text,
      );
      if (!mounted) return;

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('Đổi mật khẩu thành công')),
        );
      Navigator.of(context).pop();
    } on AuthException catch (e) {
      if (!mounted) return;
      setState(() => _serviceError = e.message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  InputDecoration _passwordDecoration({
    required String label,
    required bool obscureText,
    required VoidCallback onToggle,
  }) {
    return InputDecoration(
      labelText: label,
      suffixIcon: IconButton(
        tooltip: obscureText ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
        onPressed: _isLoading ? null : onToggle,
        icon: Icon(
          obscureText
              ? Icons.visibility_outlined
              : Icons.visibility_off_outlined,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const PfcAppBar(title: Text('Đổi mật khẩu')),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: constraints.maxHeight - 32,
                    maxWidth: 420,
                  ),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextFormField(
                          controller: _currentPasswordController,
                          obscureText: _hideCurrentPassword,
                          enabled: !_isLoading,
                          autofillHints: const [AutofillHints.password],
                          textInputAction: TextInputAction.next,
                          decoration: _passwordDecoration(
                            label: 'Mật khẩu hiện tại',
                            obscureText: _hideCurrentPassword,
                            onToggle: () => setState(
                              () =>
                                  _hideCurrentPassword = !_hideCurrentPassword,
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Vui lòng nhập mật khẩu hiện tại.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _newPasswordController,
                          obscureText: _hideNewPassword,
                          enabled: !_isLoading,
                          autofillHints: const [AutofillHints.newPassword],
                          textInputAction: TextInputAction.next,
                          decoration: _passwordDecoration(
                            label: 'Mật khẩu mới',
                            obscureText: _hideNewPassword,
                            onToggle: () => setState(
                              () => _hideNewPassword = !_hideNewPassword,
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Vui lòng nhập mật khẩu mới.';
                            }
                            if (value.length < 6) {
                              return 'Mật khẩu mới phải có ít nhất 6 ký tự.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _confirmPasswordController,
                          obscureText: _hideConfirmPassword,
                          enabled: !_isLoading,
                          autofillHints: const [AutofillHints.newPassword],
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) {
                            if (!_isLoading) _changePassword();
                          },
                          decoration: _passwordDecoration(
                            label: 'Xác nhận mật khẩu mới',
                            obscureText: _hideConfirmPassword,
                            onToggle: () => setState(
                              () =>
                                  _hideConfirmPassword = !_hideConfirmPassword,
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Vui lòng xác nhận mật khẩu mới.';
                            }
                            if (value != _newPasswordController.text) {
                              return 'Xác nhận mật khẩu mới không khớp.';
                            }
                            return null;
                          },
                        ),
                        if (_serviceError != null) ...[
                          const SizedBox(height: 16),
                          Text(
                            _serviceError!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                            ),
                          ),
                        ],
                        const SizedBox(height: 24),
                        FilledButton(
                          onPressed: _isLoading ? null : _changePassword,
                          child: _isLoading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text('Xác nhận đổi mật khẩu'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
