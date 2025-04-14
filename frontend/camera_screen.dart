import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:mime/mime.dart';
import 'dart:io';

class CameraScreen extends StatefulWidget {
  final CameraDescription camera;
  final SpeechToText speechToText;
  final bool isListening;
  final Function(String) onVoiceCommand;

  const CameraScreen({
    super.key,
    required this.camera,
    required this.speechToText,
    required this.isListening,
    required this.onVoiceCommand,
  });

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen>
    with SingleTickerProviderStateMixin {
  late CameraController _controller;
  late Future<void> _initializeControllerFuture;
  late AnimationController _animationController;
  bool _isRecording = false;

  @override
  void initState() {
    super.initState();
    _controller = CameraController(widget.camera, ResolutionPreset.medium);
    _initializeControllerFuture = _controller.initialize();

    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );

    if (widget.isListening) {
      _animationController.repeat(reverse: true);
    }

    if (!widget.speechToText.isListening) {
      widget.speechToText.listen(
        onResult: _onSpeechResult,
        listenFor: const Duration(seconds: 30),
        partialResults: true,
        listenMode: ListenMode.confirmation,
      );
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startRecording();
    });
  }

  Future<void> _startRecording() async {
    try {
      await _initializeControllerFuture;
      await _controller.startVideoRecording();
      setState(() => _isRecording = true);
      print("Recording started");
    } catch (e) {
      print("Error starting recording: $e");
    }
  }

  Future<void> _stopRecording() async {
    try {
      if (_isRecording) {
        final file = await _controller.stopVideoRecording();
        print("Recording saved at: ${file.path}");
        setState(() => _isRecording = false);

        final request = http.MultipartRequest(
          'POST',
          Uri.parse("http://localhost:8000/process_video/"),
        );
        request.files.add(await http.MultipartFile.fromPath('file', file.path,
            contentType: MediaType.parse(lookupMimeType(file.path) ?? 'video/mp4')));

        final response = await request.send();

        if (response.statusCode == 200) {
          final responseData = await response.stream.bytesToString();
          final result = jsonDecode(responseData);
          print("Summary: ${result['text_summary']}");
          final audioUrl = result['audio_file'];

          if (context.mounted) {
            showDialog(
              context: context,
              builder: (_) => AlertDialog(
                title: const Text("Upload Successful"),
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(result['text_summary']),
                    const SizedBox(height: 10),
                    const Text("Audio file ready for download."),
                  ],
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text("OK"),
                  ),
                ],
              ),
            );
          }
        } else {
          print("Upload failed: ${response.statusCode}");
        }
      }
    } catch (e) {
      print("Error stopping recording: $e");
    }
  }

  void _onSpeechResult(SpeechRecognitionResult result) async {
    final words = result.recognizedWords.toLowerCase();
    print('Detected words: $words');

    try {
      final response = await http.post(
        Uri.parse("http://localhost:8000/process_command/"),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'text': words}),
      );

      if (response.statusCode == 200) {
        final action = jsonDecode(response.body)['action'];
        if (action == "stop_video") {
          await _stopRecording();
          widget.onVoiceCommand("stop_video");
        } else if (action == "retake") {
          await _stopRecording();
          await _startRecording();
        }
      }
    } catch (e) {
      print('Voice command error: $e');
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          FutureBuilder<void>(
            future: _initializeControllerFuture,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.done) {
                return CameraPreview(_controller);
              } else {
                return const Center(child: CircularProgressIndicator());
              }
            },
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 32,
            child: Container(
              alignment: Alignment.center,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.9),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.2),
                          blurRadius: 15,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: ScaleTransition(
                      scale: Tween<double>(begin: 1.0, end: 1.2)
                          .animate(_animationController),
                      child: Icon(
                        widget.isListening ? Icons.mic : Icons.mic_none,
                        size: 48,
                        color: widget.isListening
                            ? Colors.black87
                            : Colors.black54,
                      ),
                    ),
                  ),
                  if (widget.isListening)
                    Container(
                      margin: const EdgeInsets.only(top: 8),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.7),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text(
                        'Listening...',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
