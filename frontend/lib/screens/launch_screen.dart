import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../state/app_state.dart';

class LaunchScreen extends StatefulWidget {
  const LaunchScreen({super.key});

  @override
  State<LaunchScreen> createState() => _LaunchScreenState();
}

class _LaunchScreenState extends State<LaunchScreen> {
  bool _loading = true;
  String? _error;
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    final supabase = Supabase.instance.client;
    final session = supabase.auth.currentSession;
    if (session != null && session.user != null) {
      Provider.of<AppState>(context, listen: false).setUserId(session.user!.id);
      Navigator.pushReplacementNamed(context, '/garage');
    } else {
      setState(() => _loading = false);
    }
  }

  Future<void> _login() async {
    setState(() { _loading = true; _error = null; });
    final supabase = Supabase.instance.client;
    final res = await supabase.auth.signInWithPassword(
      email: _emailController.text.trim(),
      password: _passwordController.text.trim(),
    );
    if (res.user != null) {
      Provider.of<AppState>(context, listen: false).setUserId(res.user!.id);
      Navigator.pushReplacementNamed(context, '/garage');
    } else {
      setState(() { _loading = false; _error = 'Login failed'; });
    }
  }

  Future<void> _signup() async {
    setState(() { _loading = true; _error = null; });
    final supabase = Supabase.instance.client;
    final res = await supabase.auth.signUp(
      email: _emailController.text.trim(),
      password: _passwordController.text.trim(),
    );
    if (res.user != null) {
      Provider.of<AppState>(context, listen: false).setUserId(res.user!.id);
      Navigator.pushReplacementNamed(context, '/garage');
    } else {
      setState(() { _loading = false; _error = 'Signup failed'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: _loading
            ? const CircularProgressIndicator()
            : Padding(
                padding: const EdgeInsets.all(32.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('GreaseMonkey AI', style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 24),
                    if (_error != null)
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                    TextField(
                      controller: _emailController,
                      decoration: const InputDecoration(labelText: 'Email'),
                    ),
                    TextField(
                      controller: _passwordController,
                      decoration: const InputDecoration(labelText: 'Password'),
                      obscureText: true,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        ElevatedButton(
                          onPressed: _login,
                          child: const Text('Login'),
                        ),
                        const SizedBox(width: 16),
                        OutlinedButton(
                          onPressed: _signup,
                          child: const Text('Sign Up'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
