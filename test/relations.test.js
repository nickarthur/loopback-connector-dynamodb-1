// This test written in mocha+should.js
var should = require("./init.js");

var db, Book, Chapter, Author, Reader;

describe("relations", function() {
    before(function(done) {
        db = getSchema();
        Book = db.define("Book", { id: { type: String, id: 1, keyType: "hash" } });
        Chapter = db.define("Chapter", { id: { type: String, index: true, id: 1, keyType: "hash", limit: 20 } });
        Author = db.define("Author", { id: { type: String, id: 1, keyType: "hash" } });

        Reader = db.define("Reader", {
            id: { type: String, id: 1, keyType: "hash", uuid: true }
        });

        var modelCount = 0;
        db.adapter.emitter.on("created", function() {
            modelCount++;
            // Tables for both models created in database.
            if (modelCount === 4) {
                Book.destroyAll(function() {
                    Chapter.destroyAll(function() {
                        Author.destroyAll(function() {
                            Reader.destroyAll(done);
                        });
                    });
                });
            }
        });
        done();


    });

    after(function() {
        db.disconnect();
    });

    describe("hasMany", function() {
        it("can be declared in different ways", function(done) {
            Book.hasMany(Chapter);
            Book.hasMany(Reader, { as: "users" });
            Book.hasMany(Author, { foreignKey: "projectId" });
            var b = new Book;
            b.chapters.should.be.an.instanceOf(Function);
            b.users.should.be.an.instanceOf(Function);
            b.authors.should.be.an.instanceOf(Function);
            (new Chapter).toObject().should.have.property("bookId");
            (new Author).toObject().should.have.property("projectId");
            db.automigrate(done);
        });

        it("can be declared in short form", function(done) {
            Author.hasMany("readers");
            (new Author).readers.should.be.an.instanceOf(Function);
            (new Reader).toObject().should.have.property("authorId");

            db.autoupdate(done);
        });

        it("should build record on scope", function(done) {
            Book.create({id: "book"}, function(err, book) {
                var c = book.chapters.build({id: "chap"});
                c.bookId.should.equal(book.id);
                c.save(done);
            });
        });

        it("should create record on scope", function(done) {
            Book.create({id: "book"}, function(err, book) {
                book.chapters.create({id: "chap"},function(err, c) {
                    should.not.exist(err);
                    should.exist(c);
                    c.bookId.should.equal(book.id);
                    done();
                });
            });
        });

        it("should find scoped record", function(done) {
            var id;
            Book.create({id: "book"}, function(err, book) {
                book.chapters.create({ id: "a" }, function(err, ch) {
                    id = ch.id;
                    book.chapters.create({ id: "z" }, function() {
                        book.chapters.create({ id: "c" }, function() {
                            fetch(book);
                        });
                    });
                });
            });

            function fetch(book) {
                book.chapters.findOne({ where: { id: id}}, function(err, ch) {
                    should.not.exist(err);
                    should.exist(ch);
                    ch.id.should.equal(id);
                    done();
                });
            }
        });

        it("should destroy scoped record", function(done) {
            Book.create({id: "book"}, function(err, book) {
                book.chapters.create({ id: "a" }, function(err, ch) {
                    book.chapters.destroy(ch.id, function(err) {
                        should.not.exist(err);
                        book.chapters.findById(ch.id, function(err, ch) {
                            should.exist(err);
                            err.message.should.equal("No instance with id a found for Chapter");
                            should.not.exist(ch);
                            done();
                        });
                    });
                });
            });
        });

        it("should not allow destruction of none scoped records", function(done) {
            Book.create({id: "book1"}, function(err, book1) {
                book1.chapters.create({ id: "book1chapter1" }, function(err, ch) {
                    var id = ch.id;
                    Book.create({id: "book2"}, function(err, book2) {
                        book2.chapters.destroy(ch.id, function(err) {
                            should.exist(err);
                            err.message.should.equal(`No instance with id ${id} found for Chapter`);
                            book1.chapters.findById(ch.id, function(err, ch) {
                                should.not.exist(err);
                                should.exist(ch);
                                ch.id.should.equal(id);
                                done();
                            });
                        });
                    });
                });
            });
        });

    });

    describe("belongsTo", function() {
        var List, Item, Fear, Mind;

        before(function(done) {
            var modelCount = 0;
            List = db.define("List", { id: { type: String, id: 1, keyType: "hash" } });
            Item = db.define("Item", { id: { type: String, id: 1, keyType: "hash" } });
            Fear = db.define("Fear", { id: { type: String, id: 1, keyType: "hash" } });
            Mind = db.define("Mind", { id: { type: String, id: 1, keyType: "hash" } });

            // syntax 1 (old)
            Item.belongsTo(List);
            (new Item).toObject().should.have.property("listId");
            (new Item).list.should.be.an.instanceOf(Function);

            // syntax 2 (new)
            Fear.belongsTo("mind");
            (new Fear).toObject().should.have.property("mindId");
            (new Fear).mind.should.be.an.instanceOf(Function);
            (new Fear).mind.build().should.be.an.instanceOf(Mind);


            db.adapter.emitter.on("created", function() {
                modelCount++;
                // Tables for both models created in database.
                if (modelCount === 4) {
                    List.destroyAll(function() {
                        Item.destroyAll(function() {
                            Fear.destroyAll(function() {
                                Mind.destroyAll(done);
                            });
                        });
                    });
                }
            });
            done();
        });

        it("can be used to query data", function(done) {
            List.hasMany("todos", { model: Item });
            db.automigrate(function() {
                List.create({ id: "List1" }, function(e, list) {
                    should.not.exist(e);
                    should.exist(list);
                    list.todos.create({ id: "Todos1" }, function(err, todo) {
                        todo.list(function(e, l) {
                            should.not.exist(e);
                            should.exist(l);
                            l.should.be.an.instanceOf(List);
                            todo.list().should.equal(l.id);
                            done();
                        });
                    });
                });
            });
        });

        it("could accept objects when creating on scope", function(done) {
            List.create({ id: "List2" }, function(e, list) {
                should.not.exist(e);
                should.exist(list);
                Item.create({list: list }, function(err, item) {
                    should.not.exist(err);
                    should.exist(item);
                    should.exist(item.listId);
                    item.listId.should.equal(list.id);
                    item.__cachedRelations.list.should.equal(list);
                    done();
                });
            });
        });

    });

    describe("hasAndBelongsToMany", function() {
        var Article, Tag, ArticleTag;
        before(function(done) {
            var modelCount = 0;
            Article = db.define("Article", { title: { type: String, id: 1, keyType: "hash" } });
            Tag = db.define("Tag", { id: { type: String, id: 1, keyType: "hash" } });
            Article.hasAndBelongsToMany("tags");
            ArticleTag = db.models.ArticleTag;
            db.adapter.emitter.on("created", function() {
                modelCount++;
                // Tables for both models created in database.
                if (modelCount === 3) {
                    Article.destroyAll(function() {
                        Tag.destroyAll(function() {
                            ArticleTag.destroyAll(function() {
                                done();
                            });
                        });
                    });
                }
            });
        });

        it("should allow to create instances on scope", function(done) {
            Article.create(function(e, article) {
                article.tags.create({ id: "popular" }, function(e, t) {
                    t.should.be.an.instanceOf(Tag);
                    ArticleTag.findOne(function(e, at) {
                        should.exist(at);
                        at.tagId.toString().should.equal(t.id.toString());
                        at.articleId.toString().should.equal(article.id.toString());
                        done();
                    });
                });
            });
        });

        it("should allow to fetch scoped instances", function(done) {
            Article.findOne(function(e, article) {
                article.tags(function(e, tags) {
                    should.not.exist(e);
                    should.exist(tags);
                    done();
                });
            });
        });

        it("should allow to add connection with instance", function(done) {
            Article.findOne(function(e, article) {
                Tag.create({ id: "awesome" }, function(e, tag) {
                    article.tags.add(tag, function(e, at) {
                        should.not.exist(e);
                        should.exist(at);
                        at.should.be.an.instanceOf(ArticleTag);
                        at.tagId.should.equal(tag.id);
                        at.articleId.should.equal(article.id);
                        done();
                    });
                });
            });
        });

        it("should allow to remove connection with instance", function(done) {
            Article.findOne(function(e, article) {
                article.tags(function(e, tags) {
                    var len = tags.length;
                    tags.should.not.be.empty;
                    should.exist(tags[0]);
                    article.tags.remove(tags[0], function(e) {
                        should.not.exist(e);
                        article.tags(true, function(e, tags) {
                            tags.should.have.lengthOf(len - 1);
                            done();
                        });
                    });
                });
            });
        });

        it("should remove the correct connection", function(done) {
            Article.create({ title: "Article 1" }, function(e, article1) {
                Article.create({ title: "Article 2" }, function(e, article2) {
                    Tag.create({ id: "correct" }, function(e, tag) {
                        article1.tags.add(tag, function(e, at) {
                            article2.tags.add(tag, function(e, at) {
                                article2.tags.remove(tag, function(e) {
                                    article2.tags(true, function(e, tags) {
                                        tags.should.have.lengthOf(0);
                                        article1.tags(true, function(e, tags) {
                                            tags.should.have.lengthOf(1);
                                            done();
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });

    });

});