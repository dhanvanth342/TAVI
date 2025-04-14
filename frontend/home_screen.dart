import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'camera_screen.dart';
import 'package:flutter_tts/flutter_tts.dart';

class HomeScreen extends StatefulWidget {
  final List<CameraDescription> cameras;

  const HomeScreen({super.key, required this.cameras});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  final SpeechToText _speechToText = SpeechToText();
  final AudioPlayer _audioPlayer = AudioPlayer();
  final FlutterTts flutterTts = FlutterTts();
  bool _isListening = false;
  String _capturedText = "";

  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  void _initializeApp() async {
    await _speechToText.initialize().then((_) {
      _startListening();
    });

    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );

    await flutterTts.setLanguage("en-US");
    await flutterTts.setPitch(1.0);

    flutterTts.setCompletionHandler(() => _startListening());

    await flutterTts.speak(
      'Hey there, I am TAVI, your talkative vision. To start talking to me say "Hey Tavi" and when you are done say "I am done Tavi". To perform actions, please say either "Open Camera" to start recording or "Close Camera" to stop recording.'
    );
  }

  void _startListening() async {
    if (!_speechToText.isListening) {
      await _speechToText.listen(
        onResult: _onSpeechResult,
        listenFor: const Duration(seconds: 30),
        partialResults: true,
        listenMode: ListenMode.confirmation,
        onSoundLevelChange: (level) {
          if (level > 0) _animationController.repeat(reverse: true);
        },
      );
      setState(() => _isListening = true);
    }
  }

  void _onSpeechResult(SpeechRecognitionResult result) async {
    String words = result.recognizedWords.toLowerCase();
    print('Recognized words: $words');

    try {
      final response = await http.post(
        Uri.parse("http://localhost:8000/process_command/"),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'text': words}),
      );

      if (response.statusCode == 200) {
        final Map<String, dynamic> resJson = jsonDecode(response.body);
        final action = resJson['action'];

        switch (action) {
          case 'start_video':
            if (widget.cameras.isEmpty) {
              flutterTts.speak("Sorry, no camera is available on this device");
              return;
            }
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => CameraScreen(
                  camera: widget.cameras.first,
                  speechToText: _speechToText,
                  isListening: _isListening,
                  onVoiceCommand: _handleVoiceCommand,
                ),
              ),
            );
            break;
          case 'stop_video':
            if (Navigator.canPop(context)) Navigator.pop(context);
            break;
          case 'display_text':
            String capturedText = resJson['captured_text'] ?? "";
            setState(() {
              _capturedText = capturedText;
            });
            break;
          default:
            flutterTts.speak("Sorry, I didn't understand that command");
        }
      } else {
        flutterTts.speak("Sorry, I couldn't process that command");
      }
    } catch (e) {
      print('Error processing command: $e');
      flutterTts.speak("Sorry, there was an error processing your command");
    }

    if (!_speechToText.isListening) _startListening();
  }

  void _handleVoiceCommand(String action) {
    switch (action) {
      case 'start_video':
        if (widget.cameras.isNotEmpty) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => CameraScreen(
                camera: widget.cameras.first,
                speechToText: _speechToText,
                isListening: _isListening,
                onVoiceCommand: _handleVoiceCommand,
              ),
            ),
          );
        }
        break;
      case 'stop_video':
        if (Navigator.canPop(context)) Navigator.pop(context);
        break;
      case 'retake':
        if (Navigator.canPop(context)) Navigator.pop(context);
        Future.delayed(const Duration(milliseconds: 500), () {
          _handleVoiceCommand("start_video");
        });
        break;
      default:
        flutterTts.speak("I didn't catch that. Try again.");
    }
  }

  @override
  void dispose() {
    _animationController.dispose();
    _speechToText.cancel();
    _audioPlayer.dispose();
    flutterTts.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('TAVI')),
      drawer: Drawer(
        child: ListView(
          children: [
            const DrawerHeader(
              decoration: BoxDecoration(color: Colors.black),
              child: Text('TAVI', style: TextStyle(color: Colors.white, fontSize: 24)),
            ),
            ListTile(title: const Text('Home'), onTap: () => Navigator.pop(context)),
            ListTile(title: const Text('Logout'), onTap: () => Navigator.pop(context)),
          ],
        ),
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.white, Color(0xFFF5F5F5)]),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(15),
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 20, spreadRadius: 5)],
                ),
                child: Column(
                  children: [
                    const Text('TAVI', style: TextStyle(fontSize: 64, fontWeight: FontWeight.bold, letterSpacing: 2, color: Colors.black87)),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text("Let's you hear the world", style: TextStyle(fontSize: 18, fontStyle: FontStyle.italic, color: Colors.black54)),
                    ),
                  ],
                ),
              ),
              if (_capturedText.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Text('Captured Text: $_capturedText', style: const TextStyle(fontSize: 18, color: Colors.black87)),
                ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 15, spreadRadius: 2)],
                ),
                child: Column(
                  children: [
                    ScaleTransition(
                      scale: _animationController.drive(Tween<double>(begin: 1.0, end: 1.2)),
                      child: Icon(_isListening ? Icons.mic : Icons.mic_none, size: 48, color: _isListening ? Colors.black87 : Colors.black54),
                    ),
                    if (_isListening)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text('Listening...', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: Colors.black.withOpacity(0.6))),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 48),
            ],
          ),
        ),
      ),
    );
  }
}
