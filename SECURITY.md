# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please use GitHub's Security Advisory feature:
1. Go to https://github.com/black940514/oh-my-black/security/advisories
2. Click "Report a vulnerability"
3. Fill out the form with details

You should receive a response within 48 hours.

Please include:
- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting)
- Full paths of source file(s) related to the issue
- Location of affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue

## Security Measures

oh-my-black implements the following security controls:

1. **Shell Injection Prevention**: All shell commands are sanitized
2. **Permission Validation**: Commands validated against safe patterns
3. **No Arbitrary Execution**: Only whitelisted commands allowed
4. **Input Sanitization**: User inputs sanitized before processing
