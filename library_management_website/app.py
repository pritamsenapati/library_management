import os
import re
from datetime import date, timedelta
from functools import wraps

import click
from dotenv import load_dotenv
from flask import Flask, abort, flash, redirect, render_template, request, url_for
from flask_login import LoginManager, UserMixin, current_user, login_required, login_user, logout_user
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_
from werkzeug.security import check_password_hash, generate_password_hash
from urllib.parse import urlsplit
from flask_wtf.csrf import CSRFProtect

load_dotenv()
app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.getenv("SECRET_KEY", "change-this-before-deploying"),
    SQLALCHEMY_DATABASE_URI=os.getenv(
        "DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/library_db?charset=utf8mb4"
    ),
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
)
db = SQLAlchemy(app)
CSRFProtect(app)
login_manager = LoginManager(app)
login_manager.login_view = "login"
login_manager.login_message_category = "info"


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="member")
    joined_at = db.Column(db.DateTime, nullable=False, server_default=db.func.now())
    loans = db.relationship("Loan", back_populates="user", lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Book(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False, index=True)
    author = db.Column(db.String(150), nullable=False, index=True)
    isbn = db.Column(db.String(20), unique=True, nullable=True)
    category = db.Column(db.String(80), nullable=False, default="General")
    description = db.Column(db.Text)
    total_copies = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.now())
    loans = db.relationship("Loan", back_populates="book", lazy=True)

    @property
    def available_copies(self):
        active = sum(1 for loan in self.loans if loan.status == "borrowed")
        return self.total_copies - active


class Loan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    book_id = db.Column(db.Integer, db.ForeignKey("book.id"), nullable=False, index=True)
    borrowed_at = db.Column(db.Date, nullable=False, default=date.today)
    due_date = db.Column(db.Date, nullable=False)
    returned_at = db.Column(db.Date)
    status = db.Column(db.String(20), nullable=False, default="borrowed", index=True)
    user = db.relationship("User", back_populates="loans")
    book = db.relationship("Book", back_populates="loans")
    contact = db.relationship("LoanContact", back_populates="loan", uselist=False, cascade="all, delete-orphan")


class LoanContact(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    loan_id = db.Column(db.Integer, db.ForeignKey("loan.id"), nullable=False, unique=True)
    contact_name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(30), nullable=False)
    address = db.Column(db.Text, nullable=False)
    loan = db.relationship("Loan", back_populates="contact")


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


@app.context_processor
def inject_today():
    return {"today": date.today()}


def admin_required(view):
    @wraps(view)
    @login_required
    def wrapped(*args, **kwargs):
        if current_user.role != "admin":
            abort(403)
        return view(*args, **kwargs)
    return wrapped


@app.route("/")
def index():
    term = request.args.get("q", "").strip()
    query = Book.query
    if term:
        pattern = f"%{term}%"
        query = query.filter(or_(Book.title.ilike(pattern), Book.author.ilike(pattern), Book.category.ilike(pattern)))
    books = query.order_by(Book.title).all()
    stats = {
        "titles": Book.query.count(),
        "members": User.query.filter_by(role="member").count(),
        "loans": Loan.query.filter_by(status="borrowed").count(),
    }
    return render_template("index.html", books=books, stats=stats, term=term)


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if current_user.is_authenticated:
        return redirect(url_for("index"))
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        if not name or not email or len(password) < 8:
            flash("Enter your name and email, and use a password with at least 8 characters.", "error")
        elif User.query.filter_by(email=email).first():
            flash("An account with that email already exists.", "error")
        else:
            user = User(name=name, email=email)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            login_user(user)
            flash("Welcome to The Reading Room! Your account is ready.", "success")
            return redirect(url_for("index"))
    return render_template("auth.html", mode="signup")


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("index"))
    if request.method == "POST":
        user = User.query.filter_by(email=request.form.get("email", "").strip().lower()).first()
        if user and user.check_password(request.form.get("password", "")):
            login_user(user, remember=bool(request.form.get("remember")))
            flash(f"Welcome back, {user.name.split()[0]}.", "success")
            next_url = request.args.get("next", "")
            parsed = urlsplit(next_url)
            if parsed.scheme in ("", "http", "https") and parsed.netloc in ("", request.host):
                return redirect(next_url or url_for("index"))
            return redirect(url_for("index"))
        flash("Email or password is incorrect.", "error")
    return render_template("auth.html", mode="login")


@app.post("/logout")
@login_required
def logout():
    logout_user()
    flash("You have been signed out.", "info")
    return redirect(url_for("index"))


@app.route("/books/new", methods=["GET", "POST"])
@admin_required
def add_book():
    if request.method == "POST":
        book, error = book_from_form()
        if error:
            flash(error, "error")
        else:
            db.session.add(book)
            db.session.commit()
            flash("Book added to the collection.", "success")
            return redirect(url_for("index"))
    return render_template("book_form.html", book=None)


@app.route("/books/<int:book_id>/edit", methods=["GET", "POST"])
@admin_required
def edit_book(book_id):
    book = db.get_or_404(Book, book_id)
    if request.method == "POST":
        updated, error = book_from_form(existing=book)
        if error:
            flash(error, "error")
        else:
            db.session.commit()
            flash("Book details updated.", "success")
            return redirect(url_for("index"))
    return render_template("book_form.html", book=book)


@app.post("/books/<int:book_id>/delete")
@admin_required
def delete_book(book_id):
    book = db.get_or_404(Book, book_id)
    if book.loans:
        flash("This title has loan history and cannot be deleted. Set its copies to 0 instead.", "error")
    else:
        db.session.delete(book)
        db.session.commit()
        flash("Book removed from the collection.", "success")
    return redirect(url_for("index"))


def book_from_form(existing=None):
    title = request.form.get("title", "").strip()
    author = request.form.get("author", "").strip()
    isbn = request.form.get("isbn", "").strip() or None
    category = request.form.get("category", "General").strip() or "General"
    description = request.form.get("description", "").strip()
    try:
        copies = int(request.form.get("total_copies", "1"))
        if copies < 0:
            raise ValueError
    except ValueError:
        return None, "Copies must be a whole number of 0 or more."
    if not title or not author:
        return None, "Title and author are required."
    duplicate = Book.query.filter(Book.isbn == isbn, Book.isbn.isnot(None))
    if existing:
        duplicate = duplicate.filter(Book.id != existing.id)
    if isbn and duplicate.first():
        return None, "That ISBN is already in the collection."
    book = existing or Book()
    book.title, book.author, book.isbn = title, author, isbn
    book.category, book.description, book.total_copies = category, description, copies
    active = Loan.query.filter_by(book_id=book.id, status="borrowed").count() if book.id else 0
    if copies < active:
        return None, f"There are already {active} active loans. Copies cannot be set below that."
    return book, None


@app.route("/books/<int:book_id>/borrow", methods=["GET", "POST"])
@login_required
def borrow_book(book_id):
    book = db.get_or_404(Book, book_id)
    active_for_user = Loan.query.filter_by(user_id=current_user.id, status="borrowed").count()
    already_has = Loan.query.filter_by(user_id=current_user.id, book_id=book.id, status="borrowed").first()
    if already_has:
        flash("You already have this book checked out.", "info")
        return redirect(url_for("my_loans"))
    if active_for_user >= 5:
        flash("You can have up to 5 books checked out at a time.", "error")
        return redirect(url_for("index"))
    if book.available_copies < 1:
        flash("All copies are currently checked out.", "error")
        return redirect(url_for("index"))

    previous_contact = LoanContact.query.join(Loan).filter(Loan.user_id == current_user.id).order_by(Loan.id.desc()).first()
    if request.method == "POST":
        contact_name = request.form.get("contact_name", "").strip()
        phone = request.form.get("phone", "").strip()
        address = request.form.get("address", "").strip()
        digits = re.sub(r"\D", "", phone)
        if not contact_name or not address or not re.fullmatch(r"\+?[0-9().\-\s]{7,24}", phone) or not 7 <= len(digits) <= 15:
            flash("Enter a contact name, a valid phone number, and your contact address to continue.", "error")
            return render_template("checkout.html", book=book, previous_contact=previous_contact)
        loan = Loan(user_id=current_user.id, book_id=book.id, due_date=date.today() + timedelta(days=21))
        loan.contact = LoanContact(contact_name=contact_name, phone=phone, address=address)
        db.session.add(loan)
        db.session.commit()
        flash(f"{book.title} is checked out to you for 21 days.", "success")
        return redirect(url_for("my_loans"))
    return render_template("checkout.html", book=book, previous_contact=previous_contact)


@app.post("/loans/<int:loan_id>/return")
@login_required
def return_book(loan_id):
    loan = db.get_or_404(Loan, loan_id)
    if loan.user_id != current_user.id and current_user.role != "admin":
        abort(403)
    if loan.status == "borrowed":
        loan.status, loan.returned_at = "returned", date.today()
        db.session.commit()
        flash(f"{loan.book.title} has been returned. Thank you!", "success")
    return redirect(request.referrer or url_for("my_loans"))


@app.route("/my-loans")
@login_required
def my_loans():
    loans = Loan.query.filter_by(user_id=current_user.id).order_by(Loan.borrowed_at.desc()).all()
    return render_template("my_loans.html", loans=loans)


@app.route("/admin/loans")
@admin_required
def admin_loans():
    loans = Loan.query.order_by(Loan.borrowed_at.desc()).all()
    return render_template("admin_loans.html", loans=loans)


@app.cli.command("init-db")
def init_db():
    """Create the configured database tables."""
    db.create_all()
    click.echo("Database tables are ready.")


@app.cli.command("create-admin")
@click.argument("name")
@click.argument("email")
@click.password_option()
def create_admin(name, email, password):
    """Create an administrator account."""
    if User.query.filter_by(email=email.lower()).first():
        raise click.ClickException("An account with that email already exists.")
    user = User(name=name, email=email.lower(), role="admin")
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    click.echo(f"Administrator account created for {email}.")


@app.cli.command("seed-subject-books")
def seed_subject_books():
    """Add a starter set of C, algorithms, and comedy books to the configured database."""
    books = [
        ("The C Programming Language", "Brian W. Kernighan and Dennis M. Ritchie", "C Programming", "9780131103627"),
        ("C Programming: A Modern Approach", "K. N. King", "C Programming", "9780393979503"),
        ("Head First C", "David Griffiths and Dawn Griffiths", "C Programming", "9781449399917"),
        ("Grokking Algorithms", "Aditya Bhargava", "Data Structures & Algorithms", "9781617292231"),
        ("Introduction to Algorithms", "Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, and Clifford Stein", "Data Structures & Algorithms", "9780262046305"),
        ("A Common-Sense Guide to Data Structures and Algorithms", "Jay Wengrow", "Data Structures & Algorithms", "9781680507225"),
        ("The Algorithm Design Manual", "Steven S. Skiena", "Algorithms", "9781849967204"),
        ("Bossypants", "Tina Fey", "Comedy & Memoir", "9780316056861"),
        ("Yes Please", "Amy Poehler", "Comedy & Memoir", "9780062268348"),
        ("Born a Crime", "Trevor Noah", "Comedy & Memoir", "9780399588198"),
        ("Me Talk Pretty One Day", "David Sedaris", "Comedy & Essays", "9780316776967"),
        ("Hyperbole and a Half", "Allie Brosh", "Comedy & Essays", "9781451666175"),
    ]
    added = 0
    for title, author, category, isbn in books:
        if not Book.query.filter_by(isbn=isbn).first():
            db.session.add(Book(title=title, author=author, category=category, isbn=isbn, total_copies=3))
            added += 1
    db.session.commit()
    click.echo(f"Added {added} books. {len(books) - added} were already in the catalog.")


@app.errorhandler(403)
def forbidden(_error):
    return render_template("error.html", code=403, message="You don’t have permission to do that."), 403


@app.errorhandler(404)
def not_found(_error):
    return render_template("error.html", code=404, message="We couldn’t find that page."), 404


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
