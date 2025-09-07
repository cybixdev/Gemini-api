from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.exceptions import BadRequest
import google.generativeai as genai
import os
from dotenv import load_dotenv
import logging
from datetime import datetime
import time
from functools import lru_cache

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins=["*"])

# Configure Gemini API
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

# Initialize the model
model = genai.GenerativeModel('gemini-pro')

# Rate limiting
request_times = []
MAX_REQUESTS_PER_MINUTE = 300
RATE_LIMIT_WINDOW = 300

def check_rate_limit():
    """Simple rate limiting implementation"""
    global request_times
    now = time.time()
    
    # Remove requests older than the window
    request_times = [req_time for req_time in request_times if now - req_time < RATE_LIMIT_WINDOW]
    
    # Check if we've exceeded the limit
    if len(request_times) >= MAX_REQUESTS_PER_MINUTE:
        return False
    
    # Add current request
    request_times.append(now)
    return True

@app.before_request
def before_request():
    """Check rate limit before each request"""
    if not check_rate_limit():
        return jsonify({
            'error': 'Rate limit exceeded',
            'message': 'Too many requests. Please try again later.'
        }), 429

@app.route('/')
def index():
    """API Information"""
    return jsonify({
        'name': 'Gemini API Wrapper',
        'version': '1.0.0',
        'creator': 'Jaden Afrix',
        'age': 18,
        'description': 'Free Gemini API endpoint for developers',
        'endpoints': {
            'generate': '/api/generate',
            'health': '/api/health',
            'info': '/'
        },
        'rate_limit': f'{MAX_REQUESTS_PER_MINUTE} requests per minute'
    })

@app.route('/api/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/api/generate', methods=['POST'])
def generate():
    """Generate content using Gemini API"""
    try:
        # Validate request
        if not request.is_json:
            raise BadRequest('Content-Type must be application/json')
        
        data = request.get_json()
        
        if 'prompt' not in data:
            return jsonify({
                'error': 'Missing required field: prompt'
            }), 400
        
        prompt = data.get('prompt')
        max_tokens = data.get('max_tokens', 2048)
        temperature = data.get('temperature', 0.7)
        
        # Validate parameters
        if not isinstance(prompt, str) or not prompt.strip():
            return jsonify({
                'error': 'Prompt must be a non-empty string'
            }), 400
        
        if not isinstance(max_tokens, int) or max_tokens <= 0 or max_tokens > 8192:
            return jsonify({
                'error': 'max_tokens must be between 1 and 8192'
            }), 400
        
        if not isinstance(temperature, (int, float)) or temperature < 0 or temperature > 1:
            return jsonify({
                'error': 'temperature must be between 0 and 1'
            }), 400
        
        # Generate content
        logger.info(f"Generating content for prompt: {prompt[:50]}...")
        
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=temperature
            )
        )
        
        return jsonify({
            'success': True,
            'response': response.text,
            'prompt': prompt,
            'metadata': {
                'max_tokens': max_tokens,
                'temperature': temperature,
                'timestamp': datetime.utcnow().isoformat()
            }
        })
        
    except BadRequest as e:
        logger.error(f"Bad request: {str(e)}")
        return jsonify({
            'error': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Error generating content: {str(e)}")
        return jsonify({
            'error': 'An error occurred while generating content',
            'message': str(e)
        }), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    """Chat endpoint for conversational AI"""
    try:
        if not request.is_json:
            raise BadRequest('Content-Type must be application/json')
        
        data = request.get_json()
        
        if 'message' not in data:
            return jsonify({
                'error': 'Missing required field: message'
            }), 400
        
        message = data.get('message')
        context = data.get('context', '')
        
        # Build the prompt
        if context:
            prompt = f"Context: {context}\n\nUser: {message}\nAssistant:"
        else:
            prompt = f"User: {message}\nAssistant:"
        
        # Generate response
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.8,
                max_output_tokens=2048
            )
        )
        
        return jsonify({
            'success': True,
            'response': response.text.strip(),
            'message': message,
            'context': context
        })
        
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        return jsonify({
            'error': 'Chat service unavailable',
            'message': str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Endpoint not found',
        'available_endpoints': [
            '/',
            '/api/health',
            '/api/generate',
            '/api/chat'
        ]
    }), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({
        'error': 'Internal server error',
        'message': 'Something went wrong on our end'
    }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
