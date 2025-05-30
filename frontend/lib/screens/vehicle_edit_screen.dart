import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider_pkg;
import '../models/vehicle.dart';
import '../state/app_state.dart';

class VehicleEditScreen extends StatefulWidget {
  final Vehicle vehicle;
  final int vehicleIndex;

  const VehicleEditScreen({
    super.key,
    required this.vehicle,
    required this.vehicleIndex,
  });

  @override
  State<VehicleEditScreen> createState() => _VehicleEditScreenState();
}

class _VehicleEditScreenState extends State<VehicleEditScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _engineController;
  late final TextEditingController _notesController;
  late final TextEditingController _nicknameController;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.vehicle.name);
    _engineController = TextEditingController(text: widget.vehicle.engine);
    _notesController = TextEditingController(text: widget.vehicle.notes);
    _nicknameController = TextEditingController(text: widget.vehicle.nickname);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _engineController.dispose();
    _notesController.dispose();
    _nicknameController.dispose();
    super.dispose();
  }

  Future<void> _saveVehicle() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final updatedVehicle = widget.vehicle.copyWith(
        name: _nameController.text.trim(),
        engine: _engineController.text.trim(),
        notes: _notesController.text.trim(),
        nickname: _nicknameController.text.trim(),
      );

      await provider_pkg.Provider.of<AppState>(context, listen: false)
          .updateVehicle(widget.vehicleIndex, updatedVehicle);

      if (mounted) {
        final navigator = Navigator.of(context);
        final messenger = ScaffoldMessenger.of(context);
        navigator.pop();
        messenger.showSnackBar(
          const SnackBar(content: Text('Vehicle updated successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error updating vehicle: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _deleteVehicle() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Vehicle'),
        content: Text('Are you sure you want to delete "${widget.vehicle.name}"? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      setState(() {
        _isLoading = true;
      });

      try {
        await provider_pkg.Provider.of<AppState>(context, listen: false)
            .removeVehicle(widget.vehicleIndex);

        if (mounted) {
          Navigator.pop(context); // Go back to garage
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Vehicle deleted')),
          );
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Error deleting vehicle: $e'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Vehicle'),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete, color: Colors.red),
            onPressed: _isLoading ? null : _deleteVehicle,
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_isLoading) ...[
              const LinearProgressIndicator(),
              const SizedBox(height: 16),
            ],
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Basic Information',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _nameController,
                      enabled: !_isLoading,
                      decoration: const InputDecoration(
                        labelText: 'Vehicle Name *',
                        hintText: 'e.g. 2008 Subaru WRX',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.directions_car),
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Please enter a vehicle name';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _nicknameController,
                      enabled: !_isLoading,
                      decoration: const InputDecoration(
                        labelText: 'Nickname (Optional)',
                        hintText: 'e.g. "Blue Beast", "Daily Driver"',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.favorite),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _engineController,
                      enabled: !_isLoading,
                      decoration: const InputDecoration(
                        labelText: 'Engine *',
                        hintText: 'e.g. EJ255, LS3, 2JZ-GTE',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.build),
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Please enter the engine type';
                        }
                        return null;
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Additional Details',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _notesController,
                      enabled: !_isLoading,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        labelText: 'Notes (Optional)',
                        hintText: 'Any modifications, maintenance notes, or other details...',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.notes),
                        alignLabelWithHint: true,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isLoading ? null : () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _saveVehicle,
                    child: _isLoading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Save Changes'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
